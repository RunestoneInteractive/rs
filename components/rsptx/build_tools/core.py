# *******************************************
# |docname| - reusable functions for rsmanage
# *******************************************
# These functions are used by the rsmanage command in RunestoneServer as well as
# by the AuthorServer in its Celery worker tasks.  There may be other places that
# find these utils handy as well.
#
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import datetime
import os
import re
import subprocess
from pathlib import Path
import logging
from io import StringIO
from shutil import copytree

# Third Party
# -----------
import click
import lxml.etree as ET
import pretext
from pretext.utils import is_earlier_version
import pretext.project

# import xml.etree.ElementTree as ET

from sqlalchemy import create_engine, Table, MetaData, and_, update
from sqlalchemy.orm.session import sessionmaker
from sqlalchemy.sql import text

# todo: use our logger
from rsptx.logging import rslogger
from runestone.server import get_dburl
from rsptx.db.models import Library, LibraryValidator
from rsptx.db.crud import update_source_code_sync
from rsptx.response_helpers.core import canonical_utcnow

rslogger.setLevel("WARNING")

# Local packages
# --------------


QT_MAP = {
    "multiplechoice": "mchoice",
    "parsons": "parsonsprob",
}


# Build a Runestone Book
# ----------------------
def _build_runestone_book(config, course, click=click):
    """
    Parameters:
    course: the name of the course to build.
    click: default is the click module otherwise an object that has an echo method
    """
    try:
        if os.path.exists("pavement.py"):
            # Since this may be used in a long running process (see AuthorServer/worker)
            # using import is a bad idea, exec can be dangerous as well
            paver_vars = {}
            exec(open("pavement.py").read(), paver_vars)
        else:
            click.echo(
                f"I can't find a pavement.py file in {os.getcwd()} you need that to build"
            )
            return {"completed": False, "status": "Missing pavement.py file"}
    except ImportError as e:
        click.echo("You do not appear to have a good pavement.py file.")
        print(e)
        return {"completed": False, "status": "Invalid pavement.py file"}

    # If the click object has a worker attribute then we are running in a worker
    # process and **know** we are making a build for a runestone server. In that
    # case we need to make sure that the dynamic_pages flag is set to True in
    # pavement.py
    dp = True
    if "dynamic_pages" in paver_vars:
        if paver_vars["dynamic_pages"] is not True:
            dp = False
            if "dynamic_pages" in paver_vars["options"].build.template_args:
                dp = paver_vars["options"].build.template_args["dynamic_pages"]

    if hasattr(click, "worker") and dp is not True:
        click.echo("dynamic_pages must be set to True in pavement.py")
        return {
            "completed": False,
            "status": "dynamic_pages must be set to True in pavement.py",
        }
    if paver_vars["project_name"] != course:
        click.echo(
            f"Error: {course} and {paver_vars['project_name']} do not match.  Your course name needs to match the project_name in pavement.py"
        )
        return {
            "completed": False,
            "status": "Course name does not match project_name in pavement.py",
        }
    if paver_vars["options"].build.template_args["basecourse"] != course:
        click.echo(
            f"Error: {course} and {paver_vars['options'].build.template_args['basecourse']} do not match.  Your course name needs to match the basecourse in pavement.py"
        )
        return {
            "completed": False,
            "status": "Course name does not match basecourse in pavement.py",
        }

    click.echo("Running runestone build --all")
    res = subprocess.run("runestone build --all", shell=True, capture_output=True)
    with open("author_build.log", "wb") as olfile:
        olfile.write(res.stdout)
        olfile.write(b"\n====\n")
        olfile.write(res.stderr)

    if res.returncode != 0:
        click.echo(
            f"building the book failed {res}, check the log for errors and try again"
        )
        return {"completed": False, "status": "Build failed, check the log for errors"}
    click.echo("Build succeedeed... Now deploying to published")
    if paver_vars["dest"] != "./published":
        click.echo(
            "Incorrect deployment directory.  dest should be ./published in pavement.py"
        )
        return {
            "completed": False,
            "status": "Incorrect deployment directory in pavement.py",
        }

    resd = subprocess.run("runestone deploy", shell=True, capture_output=True)
    with open("author_build.log", "ab") as olfile:
        olfile.write(res.stdout)
        olfile.write(b"\n====\n")
        olfile.write(res.stderr)
    if resd.returncode == 0:
        click.echo("Success! Book deployed")
    else:
        click.echo("Deploy failed, check the log to see what went wrong.")
        return {"completed": False, "status": "Deploy failed, check the log"}

    update_library(config, "", course, click, build_system="Runestone")
    return {"completed": True, "status": "Build completed successfully"}


# Build a PreTeXt Book
# --------------------
def _build_ptx_book(config, gen, manifest, course, click=click, target="runestone"):
    """
    Parameters:
    config : This originated as a config object from click -- a mock config will be provided by the AuthorServer
    gen: A flag to indicate whether or not we should build static assets
    manifest: the name of the manifest file
    course: the name of the course to build.
    click: default is the click module otherwise an object that has an echo method
    """

    if not os.path.exists("project.ptx"):
        click.echo("PreTeXt books need a project.ptx file")
        return {"completed": False, "status": "Missing project.ptx file"}
    else:
        click.echo("Checking files")
        if not target:
            target = "runestone"
        # sets output_dir to `published/<course>`
        # and {"host-platform": "runestone"} in stringparams
        rs = check_project_ptx(click=click, course=course, target=target)
        if not rs:
            return {"completed": False, "status": "Bad configuration in project.ptx"}

        logger = logging.getLogger("ptxlogger")
        string_io_handler = StringIOHandler()
        logger.addHandler(string_io_handler)
        if hasattr(click, "worker"):
            click.add_logger(logger)
        click.echo("Building the book")
        if gen:
            click.echo("Generating assets")
            rs.generate_assets(only_changed=False, skip_cache=True)

        rs.build()  # build the book, generating assets as needed
        log_path = (
            Path(os.environ.get("BOOK_PATH")) / rs.output_dir / "author_build.log"
        )
        if not log_path.parent.exists():
            log_path.parent.mkdir(parents=True, exist_ok=True)
        click.echo(f"Writing log to {log_path}")
        log_string = string_io_handler.getvalue()
        with open(log_path, "a") as olfile:
            olfile.write(log_string)

        book_path = (
            Path(os.environ.get("BOOK_PATH"))
            / rs.output_dir
            / "published"
            / rs.output_dir
        )

        click.echo(f"Book will be deployed to {book_path}")
        if rs.output_dir_abspath() != book_path:
            res = copytree(rs.output_dir_abspath(), book_path, dirs_exist_ok=True)
            if not res:
                click.echo("Error copying files to published")
                return {
                    "completed": False,
                    "status": "Error copying files to published",
                }
        else:
            click.echo("No need to copy files to published")
        click.echo("Book deployed successfully")
        mpath = rs.output_dir_abspath() / manifest
        process_manifest(course, mpath)
        # Fetch and copy the runestone components release as advertised by the manifest
        # - Use wget to get all the js files and put them in _static
        # Beginning with 2.6.1 PreTeXt populates the _static folder with the latest
        if is_earlier_version(pretext.VERSION, "2.6.1"):
            click.echo("populating with the latest runestone files")
            populate_static(config, mpath, course)
        # update the library page
        click.echo("updating library metadata...")
        main_page = find_real_url(course)
        update_library(config, mpath, course, main_page=main_page, build_system="PTX")

        # since rs.build() does not return a status we have to parse the log for failures
        if "FATAL" in log_string:
            click.echo("Fatal errors, build aborted, check the log for details")
            return {"completed": False, "status": "Fatal errors in build"}
        if (
            "ERROR" in log_string
            or "Traceback" in log_string
            or "compilation failed" in log_string
        ):
            click.echo("Nonfatal errors in build, check the log for details")
            return {"completed": True, "status": "Nonfatal errors in build"}
        click.echo("Build completed successfully")
        return {"completed": True, "status": "Build completed successfully"}


# Support Functions
# -----------------


def process_manifest(cname, mpath, click=click):
    """
    cname - the name of the course
    mpath - path to the runestone-manifest.xml file

    Setup this book in the database and populate the questions table as well as
    The chapter and subchapter tables.
    """
    click.echo("processing manifest...")
    if os.path.exists(mpath):
        manifest_data_to_db(cname, mpath)
    else:
        raise IOError(
            f"You must provide a valid path to a manifest file: {mpath} does not exist."
        )
    return True


def check_project_ptx(click=click, course=None, target="runestone"):
    """
    Verify that the PreTeXt project is set up for a Runestone build

    Returns: Runestone target from PreTeXt project

    1. Ensure there is a runestone target in project.ptx
    2. Set project output to published directory
    3. Ensure the top level source file exists
    4. Ensure the publisher file exists
    5. Ensure the document-id exists
    6. Set target output to document-id

    """
    proj = pretext.project.Project.parse("project.ptx")
    if not target:
        target = "runestone"
    target_name = target
    if proj.has_target(target_name) is False:
        if proj.has_target("web"):
            target_name = "web"
        elif proj.has_target("html"):
            target_name = "html"
        else:
            click.echo(f"No {target} suitable targets in project.ptx")
            return False
        click.echo(
            f"No {target} target in project.ptx, will adopt {target_name} target"
        )

    book_path = os.environ.get("BOOK_PATH", None)
    if book_path is None:
        click.echo("BOOK_PATH must be set in the environment")
        return False

    tgt = proj.get_target(target_name)

    rslogger.info(f"target name: {target_name}")
    rslogger.info(f"target source: {tgt.source_abspath()}")
    rslogger.info(f"target publication: {tgt.publication_abspath()}")
    if not tgt.source_abspath().exists():
        click.echo(f"Source file specified in {target_name} target does not exist")
        return False
    if not tgt.publication_abspath().exists():
        click.echo(f"Publication file specified in {target_name} target does not exist")
        return False

    docid_list = tgt.source_element().xpath("/pretext/docinfo/document-id/text()")
    if len(docid_list) < 1:
        click.echo(
            f"Source file specified in runestone {target_name} does not have a document-id"
        )
        docid = course
    else:
        docid = docid_list[0]

    if course is not None and docid != course:
        click.echo(f"Error course: {course} does not match document-id: {docid}")
        return False

    tgt.output_dir = Path(docid)

    tgt.stringparams.update({"host-platform": "runestone"})

    return tgt


def extract_docinfo(tree, string, attr=None, click=click):
    """
    Parameters:
    tree: The parsed document tree from ET
    string: The name of the element we are looking for
    Helper to get the contents of several tags from the docinfo element of a PreTeXt book
    """
    authstr = ""
    if string == "author":
        el = tree.findall(f"./{string}")
        for a in el:
            authstr += ET.tostring(a, encoding="unicode", method="text").strip() + ", "
        authstr = authstr[:-2]
        return authstr
    el = tree.find(f"./{string}")
    if attr is not None and el is not None:
        print(f"{el.attrib[attr]=}")
        return el.attrib[attr].strip()

    if el is not None:
        # using method="text" will strip the outer tag as well as any html tags in the value
        return ET.tostring(el, encoding="unicode", method="text").strip()
    return ""


def update_library(
    config, mpath, course, click=click, build_system="", main_page="index.html"
):
    """
    Parameters:
    config : This originated as a config object from click -- a mock config will be provided by the AuthorServer
    mpath: Path to the runestone-manifest file which containes the library metadata
    course: the name of the course we are buildingn

    Update the library table using meta data from the book

    Returns: Nothing
    """
    # This is a bit of a hack for now... todo: continue to refactor these to use crud functions
    eng = create_engine(config.dburl.replace("+asyncpg", ""))
    if build_system == "PTX":
        tree = ET.parse(mpath)
        docinfo = tree.find("./library-metadata")
        title = extract_docinfo(docinfo, "title")
        subtitle = extract_docinfo(docinfo, "subtitle")
        description = extract_docinfo(docinfo, "blurb")
        shelf = extract_docinfo(docinfo, "shelf")
        author = extract_docinfo(docinfo, "author")
    else:
        author = ""
        try:
            config_vars = {}
            exec(open("conf.py").read(), config_vars)
        except Exception as e:
            print(f"Error adding book {course} to library list: {e}")
            return
        subtitle = ""
        if "navbar_title" in config_vars:
            title = config_vars["navbar_title"]
        elif "html_title" in config_vars:
            title = config_vars["html_title"]
        elif "html_short_title" in config_vars:
            title = config_vars["html_short_title"]
        else:
            title = "Runestone Book"
        # update course description if found in the book's conf.py
        if "course_description" in config_vars:
            description = config_vars["course_description"]
        else:
            description = ""
        # update course key_words if found in book's conf.py
        # if "key_words" in config_vars:
        #     key_words = config_vars["key_words"]

        if "shelf_section" in config_vars:
            shelf = config_vars["shelf_section"]
        else:
            shelf = "Computer Science"

    click.echo(f"{title} : {subtitle}")

    Session = sessionmaker()
    eng.connect()
    Session.configure(bind=eng)
    sess = Session()

    try:
        res = sess.execute(
            text("select * from library where basecourse = :course"), {"course": course}
        )
    except Exception as e:
        click.echo(f"Error querying library table: {e}")
        return False
    # using the Model rather than raw sql ensures that everything is properly escaped
    build_time = canonical_utcnow()
    click.echo(f"BUILD time is {build_time}")
    if res.rowcount == 0:
        new_lib = LibraryValidator(
            title=title,
            subtitle=subtitle,
            description=description,
            shelf_section=shelf,
            basecourse=course,
            build_system=build_system,
            main_page=main_page,
            last_build=build_time,
            for_classes="F",
            is_visible="T",
            authors=author,
        )
        new_book = Library(**new_lib.dict())
        with Session.begin() as s:
            s.add(new_book)
    else:
        # If any values are missing or null do not override them here.
        #
        res = res.first()
        if not title:
            title = res.title or ""
        if not subtitle:
            subtitle = res.subtitle or ""
        if not description:
            description = res.description or ""
        if not shelf:
            shelf = res.shelf_section or "Misc"
        click.echo("Updating library")
        stmt = (
            update(Library)
            .where(Library.basecourse == course)
            .values(
                title=title,
                subtitle=subtitle,
                description=description,
                shelf_section=shelf,
                build_system=build_system,
                main_page=main_page,
                last_build=build_time,
                authors=author,
            )
        )
        with Session.begin() as session:
            session.execute(stmt)
    return True


def find_real_url(book):
    idx = Path("published", book, "index.html")
    if idx.exists():
        with open(idx, "r") as idxf:
            for line in idxf:
                if g := re.search(r"refresh.*URL='(.*?)'", line):
                    return g.group(1)
    return "index.html"


def populate_static(config, mpath: Path, course: str, click=click):
    """
    Copy the apropriate Javascript to the _static folder for PreTeXt books.  This may
    involve downloading it from the Runestone CDN.  PreTeXt does not include the current set
    of javascript files like the Runestone components release does, instead we supply it
    on runestone.academy/cdn/runestone so it can be used for generic html builds as well as
    builds on runestone.academy.
    """
    # <runestone-services version="6.2.1"/>
    sdir = mpath.parent / "_static"
    current_version = ""
    if (sdir / "webpack_static_imports.xml").exists():
        tree = ET.parse(sdir / "webpack_static_imports.xml")
        current_version = tree.find("./version").text
    else:
        sdir.mkdir(mode=0o775, exist_ok=True)  # NB mode must be in Octal!
    if mpath.exists():
        tree = ET.parse(mpath)
        el = tree.find("./runestone-services[@version]")
        version = el.attrib["version"].strip()
    else:
        click.echo("Error: missing runestone-manifest.xml file")
        return False
    # Do not download if the versions already match.
    if version != current_version:
        click.echo(f"Fetching {version} files to {sdir} ")
        # remove the old files, but keep the lunr-pretext-search-index.js file if it exists
        for f in os.listdir(sdir):
            try:
                if "lunr-pretext" not in f and Path(sdir, f).is_file():
                    os.remove(sdir / f)
            except Exception:
                click.echo(f"ERROR - could not delete {sdir} / {f}")
        # call wget non-verbose, recursive, no parents, no hostname, no directoy copy files to sdir
        # trailing slash is important or otherwise you will end up with everything below runestone
        res = subprocess.call(
            f"""wget -nv -r -np -nH -nd -P {sdir} https://runestone.academy/cdn/runestone/{version}/
    """,
            shell=True,
        )
        if res != 0:
            click.echo("wget of runestone files failed")
            return False
    else:
        click.echo(f"_static files already up to date for {version}")
    return True


def manifest_data_to_db(course_name, manifest_path):
    """Read the runestone-manifest.xml file generated by PreTeXt and populate the
    chapters, subchapters, and questions table so that PreTeXt books can be used on
    Runestone.Academy.

    Arguments:
        course_name {string} -- Name of the course (should be a base course)
        manifest_path {path} -- path to runestone-manifest.xml file
    """
    try:
        DBURL = get_dburl()
    except KeyError:
        rslogger.error("PreTeXt integration requires a valid WEB2PY Environment")
        rslogger.error("make sure SERVER_CONFIG and DBURLs are set up")
        exit(-1)

    engine = create_engine(DBURL)
    Session = sessionmaker()
    engine.connect()
    Session.configure(bind=engine)
    sess = Session()

    # Initialize database tables and metadata
    db_context = _initialize_db_context(engine, sess, course_name, manifest_path)

    # Clean up old data
    print("Cleaning up old data...")
    _cleanup_old_data(sess, db_context, course_name)

    # Process chapters and content
    _process_chapters(sess, db_context, course_name, manifest_path)

    # And appendices. They should not have questions, but may have source code/datafiles
    _process_appendices(sess, db_context, course_name, manifest_path)

    # Set course attributes
    _set_course_attributes(sess, db_context, course_name, manifest_path)

    sess.commit()


def _initialize_db_context(engine, sess, course_name, manifest_path):
    """Initialize database tables and extract metadata from manifest."""
    meta = MetaData()
    chapters = Table("chapters", meta, autoload_with=engine)
    subchapters = Table("sub_chapters", meta, autoload_with=engine)
    questions = Table("questions", meta, autoload_with=engine)
    book_author = Table("book_author", meta, autoload_with=engine)
    source_code = Table("source_code", meta, autoload_with=engine)
    course_attributes = Table("course_attributes", meta, autoload_with=engine)
    assignments = Table("assignments", meta, autoload_with=engine)
    assignment_questions = Table("assignment_questions", meta, autoload_with=engine)

    # Get the author name from the manifest
    tree = ET.parse(manifest_path)
    docinfo = tree.find("./library-metadata")
    author = extract_docinfo(docinfo, "author")
    res = sess.execute(book_author.select().where(book_author.c.book == course_name))
    book_author_data = res.first()
    owner = book_author_data.author  # the owner is the username of the author

    # Compile image patterns
    ext_img_patt = re.compile(r"""src="external""")
    gen_img_patt = re.compile(r"""src="generated""")

    course = sess.execute(
        text(f"select * from courses where course_name ='{course_name}'")
    ).first()

    return {
        "chapters": chapters,
        "subchapters": subchapters,
        "questions": questions,
        "book_author": book_author,
        "source_code": source_code,
        "course_attributes": course_attributes,
        "assignments": assignments,
        "assignment_questions": assignment_questions,
        "author": author,
        "owner": owner,
        "course": course,
        "ext_img_patt": ext_img_patt,
        "gen_img_patt": gen_img_patt,
    }


def _cleanup_old_data(sess, db_context, course_name):
    """Clean up old chapters and mark existing questions as not from source."""
    rslogger.info(f"Cleaning up old chapters info for {course_name}")

    # Delete the chapter rows before repopulating
    sess.execute(
        db_context["chapters"]
        .delete()
        .where(db_context["chapters"].c.course_id == course_name)
    )

    # Mark existing questions as from_source = 'F'
    sess.execute(
        db_context["questions"]
        .update()
        .where(db_context["questions"].c.base_course == course_name)
        .values(from_source="F")
    )


def _process_chapters(sess, db_context, course_name, manifest_path):
    """Process all chapters from the manifest."""
    rslogger.info("Populating the database with Chapter information")

    tree = ET.parse(manifest_path)
    root = tree.getroot()
    chap = 0

    for chapter in root.findall("./chapter"):
        chap += 1
        chapid = _process_single_chapter(sess, db_context, chapter, chap, course_name)
        _process_subchapters(sess, db_context, chapter, chapid, course_name)


def _process_appendices(sess, db_context, course_name, manifest_path):
    """Process all appendices from the manifest."""
    rslogger.info("Populating the database with Appendix information")

    tree = ET.parse(manifest_path)
    root = tree.getroot()

    for appendix in root.findall("./appendix"):
        _process_source_elements(sess, appendix, course_name)

        for data_file in appendix.findall("./datafile"):
            el = data_file.find(".//*[@data-component]")
            _handle_datafile(el, course_name)


def _process_single_chapter(sess, db_context, chapter, chap_num, course_name):
    """Process a single chapter and return its database ID."""
    cnum = chapter.find("./number").text
    if not cnum:
        cnum = ""
    rslogger.debug(
        f"{chapter.tag} {chapter.find('./id').text} {chapter.find('./title').text}"
    )

    ins = (
        db_context["chapters"]
        .insert()
        .values(
            chapter_name=f"{cnum} {chapter.find('./title').text}",
            course_id=course_name,
            chapter_label=chapter.find("./id").text,
            chapter_num=chap_num,
        )
    )
    res = sess.execute(ins)
    return res.inserted_primary_key[0]

import pdb
def _process_subchapters(sess, db_context, chapter, chapid, course_name):
    """Process all subchapters for a given chapter."""
    subchap = 0

    for subchapter in chapter.findall("./subchapter"):
        # check if this subchapter has a time-limit attribute
        if "data-time" in subchapter.attrib:
            _process_single_timed_assignment(
                sess, db_context, chapter, subchapter, course_name
            )
            continue
        # look for a subsubchapter with a time-limit attribute
        # at this point (7/28/2025) the only reason for a subsubchapter
        # is to have a timed assignment, so we can skip the rest of the
        # find all divs with a class of timedAssessment
        #pdb.set_trace()
        for timed_assessment_div in subchapter.findall(".//div[@class='timedAssessment']"):
            _process_single_timed_assignment(
                sess,
                db_context,
                chapter,
                timed_assessment_div,
                course_name,
                parent=subchapter,
            )

        subchap += 1
        _process_single_subchapter(
            sess, db_context, chapter, subchapter, chapid, subchap, course_name
        )


def _process_single_subchapter(
    sess, db_context, chapter, subchapter, chapid, subchap_num, course_name
):
    """Process a single subchapter and its contents."""
    scnum = subchapter.find("./number").text
    if not scnum:
        scnum = ""
    chap_xmlid = subchapter.find("./id").text
    rslogger.debug(f"subchapter {chap_xmlid}")

    if not chap_xmlid:
        rslogger.error(f"Missing id tag in subchapter {subchapter}")

    # Build subchapter title
    titletext = subchapter.find("./title").text
    if not titletext:
        rslogger.debug(f"constructing title for subchapter {chap_xmlid}")
        titletext = " ".join(
            [ET.tostring(y).decode("utf8") for y in subchapter.findall("./title/*")]
        )
    titletext = scnum + " " + titletext.strip()

    # Insert subchapter
    ins = (
        db_context["subchapters"]
        .insert()
        .values(
            sub_chapter_name=titletext,
            chapter_id=chapid,
            sub_chapter_label=subchapter.find("./id").text,
            skipreading="F",
            sub_chapter_num=subchap_num,
        )
    )
    sess.execute(ins)

    # Add page entry to questions table
    _add_page_question(sess, db_context, chapter, subchapter, course_name)

    # Process questions in this subchapter
    _process_questions(sess, db_context, chapter, subchapter, course_name)

    # Process source elements
    _process_source_elements(sess, subchapter, course_name)


def _upsert_assignment(sess, db_context, assignment_data):
    """Insert or update an assignment in the database.

    Args:
        sess: Database session
        db_context: Database context containing table references
        assignment_data: Dictionary containing assignment data

    Returns:
        Assignment ID (either new or existing)
    """
    assignments_table = db_context["assignments"]

    # Check if assignment already exists
    existing_query = assignments_table.select().where(
        and_(
            assignments_table.c.name == assignment_data["name"],
            assignments_table.c.course == assignment_data["course"],
        )
    )
    existing_result = sess.execute(existing_query).first()

    if existing_result:
        # Update existing assignment
        update_stmt = (
            assignments_table.update()
            .where(assignments_table.c.id == existing_result.id)
            .values(**assignment_data)
        )
        sess.execute(update_stmt)
        return existing_result.id
    else:
        # Insert new assignment
        insert_stmt = assignments_table.insert().values(**assignment_data)
        result = sess.execute(insert_stmt)
        return result.inserted_primary_key[0]


def _upsert_assignment_question(
    sess, db_context, assignment_id, question_id, sorting_priority
):
    """Insert or update an assignment question in the database.

    Args:
        sess: Database session
        db_context: Database context containing table references
        assignment_id: ID of the assignment
        question_id: ID of the question
        sorting_priority: Sorting priority for the question in the assignment

    Returns:
        Assignment question ID (either new or existing)
    """
    assignment_questions_table = db_context["assignment_questions"]

    # Check if assignment question already exists
    existing_query = assignment_questions_table.select().where(
        and_(
            assignment_questions_table.c.assignment_id == assignment_id,
            assignment_questions_table.c.question_id == question_id,
        )
    )
    existing_result = sess.execute(existing_query).first()

    assignment_question_data = {
        "assignment_id": assignment_id,
        "question_id": question_id,
        "points": 1,
        "sorting_priority": sorting_priority,
        "which_to_grade": "last_answer",
        "autograde": "pct_correct",
    }

    if existing_result:
        # Update existing assignment question
        update_stmt = (
            assignment_questions_table.update()
            .where(assignment_questions_table.c.id == existing_result.id)
            .values(**assignment_question_data)
        )
        sess.execute(update_stmt)
        return existing_result.id
    else:
        # Insert new assignment question
        insert_stmt = assignment_questions_table.insert().values(
            **assignment_question_data
        )
        result = sess.execute(insert_stmt)
        return result.inserted_primary_key[0]


def _process_single_timed_assignment(
    sess, db_context, chapter, subchapter, course_name, parent=None
):
    """Process a timed assignment subchapter."""
    subchapter = subchapter.find("./ul[@data-component='timedAssessment']")
    rslogger.info("Processing timed assignment subchapter")
    titletext = subchapter.find("./title")
    if titletext is not None:
        titletext = titletext.text.strip()
    if not titletext:
        titletext = "Timed Assignment"
    timed_id = subchapter.attrib.get("id", None)
    time_limit = subchapter.attrib.get("data-time", "0")
    # no-result, no-feedback, no-pause
    show_feedback = "F" if subchapter.attrib.get("data-no-feedback", "") else "T"
    pause = "F" if subchapter.attrib.get("data-no-pause", "") else "T"

    # Prepare assignment data
    assignment_data = {
        "name": timed_id,
        "is_timed": "T",
        "is_peer": "F",
        "time_limit": time_limit,
        "nopause": pause,
        "nofeedback": show_feedback,
        "duedate": datetime.datetime.now() + datetime.timedelta(days=7),
        "course": db_context["course"].id,
        "kind": "Timed",
        "released": "F",
        "visible": "T",
        "from_source": "T",
    }

    # Upsert the assignment
    assignment_id = _upsert_assignment(sess, db_context, assignment_data)

    # Now search for questions in this subchapter
    qnum = 0
    for question in subchapter.findall("./question"):
        qnum += 1
        # Extract question content
        dbtext = " ".join(
            [ET.tostring(y).decode("utf8") for y in question.findall("./htmlsrc/*")]
        )
        qlabel = " ".join([y.text for y in question.findall("./label")])

        # Get question element and metadata
        el, idchild, old_ww_id, qtype = _extract_question_metadata(question, dbtext)

        # Handle webwork case where we need to update dbtext
        if qtype == "webwork" and el is not None:
            dbtext = ET.tostring(el).decode("utf8")

        # Build question data
        if parent is not None:
            subchap_label = parent.find("./id").text
        else:
            subchap_label = subchapter.find("./id").text
        valudict = dict(
            base_course=course_name,
            name=idchild,
            timestamp=datetime.datetime.now(),
            is_private="F",
            question_type=qtype,
            htmlsrc=dbtext,
            autograde=_determine_autograde(dbtext),
            from_source="T",
            chapter=chapter.find("./id").text,
            subchapter=subchap_label,
            topic=f"{chapter.find('./id').text}/{subchapter.attrib.get('id', '')}",
            qnumber=qlabel,
            optional="F",
            practice="F",
            author=db_context["author"],
            owner=db_context["owner"],
        )

        # Insert or update question
        namekey = old_ww_id if old_ww_id else idchild
        qid = _upsert_question(sess, db_context, namekey, valudict, course_name)
        # Add or update the question to the assignment_questions table
        _upsert_assignment_question(sess, db_context, assignment_id, qid, qnum)


def _add_page_question(sess, db_context, chapter, subchapter, course_name):
    """Add a page entry to the questions table for this chapter/subchapter."""
    name = f"{chapter.find('./title').text}/{subchapter.find('./title').text}"

    res = sess.execute(
        text(
            "select * from questions where name = :name and base_course = :course_name"
        ),
        dict(name=name, course_name=course_name),
    ).first()

    valudict = dict(
        base_course=course_name,
        name=name,
        timestamp=datetime.datetime.now(),
        is_private="F",
        question_type="page",
        subchapter=subchapter.find("./id").text,
        chapter=chapter.find("./id").text,
        from_source="T",
        author=db_context["author"],
        owner=db_context["owner"],
    )

    if res:
        ins = (
            db_context["questions"]
            .update()
            .where(
                and_(
                    db_context["questions"].c.name == name,
                    db_context["questions"].c.base_course == course_name,
                )
            )
            .values(**valudict)
        )
    else:
        ins = db_context["questions"].insert().values(**valudict)

    sess.execute(ins)


def _process_questions(sess, db_context, chapter, subchapter, course_name):
    """Process all questions in a subchapter."""
    for question in subchapter.findall("./question"):
        _process_single_question(
            sess, db_context, chapter, subchapter, question, course_name
        )


def _process_single_question(
    sess, db_context, chapter, subchapter, question, course_name
):
    """Process a single question element."""
    # Extract question content
    dbtext = " ".join(
        [ET.tostring(y).decode("utf8") for y in question.findall("./htmlsrc/*")]
    )
    qlabel = " ".join([y.text for y in question.findall("./label")])

    # Get question element and metadata
    el, idchild, old_ww_id, qtype = _extract_question_metadata(question, dbtext)

    # Handle webwork case where we need to update dbtext
    if qtype == "webwork" and el is not None:
        dbtext = ET.tostring(el).decode("utf8")

    if qtype == "dual":
        # dual questions have two components, we need to extract both
        # the second component has the id we want
        dynamic = el.find(".//*[@data-component]")
        if dynamic is not None and "id" in dynamic.attrib:
            idchild = dynamic.attrib["id"]
            qtype = dynamic.attrib["data-component"]
    if qtype == "doenet":
        # rewrite the url in the dbtext to use the course name in the path
        dbtext = re.sub(
            r'(<iframe.*?)src="(.*?.html)"',
            rf'\1 src="/ns/books/published/{course_name}/\2"',
            dbtext,
        )
    optional = "T" if ("optional" in question.attrib or qtype == "datafile") else "F"
    practice = _determine_practice_flag(qtype, el)
    autograde = _determine_autograde(dbtext)

    # Fix image URLs
    dbtext = _fix_image_urls(dbtext, db_context, course_name)

    # Build question data
    sbc = subchapter.find("./id").text
    cpt = chapter.find("./id").text
    valudict = dict(
        base_course=course_name,
        name=idchild,
        timestamp=datetime.datetime.now(),
        is_private="F",
        question_type=qtype,
        htmlsrc=dbtext,
        autograde=autograde,
        from_source="T",
        chapter=cpt,
        subchapter=sbc,
        topic=f"{cpt}/{sbc}",
        qnumber=qlabel,
        optional=optional,
        practice=practice,
        author=db_context["author"],
        owner=db_context["owner"],
    )

    # Insert or update question
    namekey = old_ww_id if old_ww_id else idchild
    _upsert_question(sess, db_context, namekey, valudict, course_name)

    # Handle datafile content
    if qtype == "datafile":
        _handle_datafile(el, course_name)


def _extract_question_metadata(question, dbtext):
    """Extract metadata from a question element."""
    el = question.find(".//*[@data-component]")
    old_ww_id = None

    if el is not None:
        idchild = el.attrib.get("id", "fix_me")
        if "the-id-on-the-webwork" in el.attrib:
            old_ww_id = el.attrib["the-id-on-the-webwork"]
    else:
        el = question.find("./div")
        if el is None:
            idchild = "fix_me"
            rslogger.error(
                f"no id found for question: \n{ET.tostring(question).decode('utf8')}"
            )
        else:
            idchild = el.attrib.get("id", "fix_me")

    # Determine question type
    try:
        qtype = el.attrib["data-component"]
        if qtype == "codelens":
            id_el = el.find("./*[@class='pytutorVisualizer']")
            idchild = id_el.attrib["id"]
        qtype = QT_MAP.get(qtype, qtype)
    except Exception:
        if el is not None:
            qtype = "webwork"
            # Note: dbtext will be updated with ET.tostring(el) in the calling function if needed
        else:
            qtype = "unknown"

    return el, idchild, old_ww_id, qtype


def _determine_practice_flag(qtype, el):
    """Determine if this is a practice question."""
    if qtype == "webwork":
        return "T"
    if el is not None and "practice" in el.attrib:
        return "T"
    return "F"


def _determine_autograde(dbtext):
    """Determine autograde setting based on content."""
    extraCode = ""
    if "====" in dbtext:
        extraCode = dbtext.partition("====")[2]
    elif "===!" in dbtext:
        extraCode = dbtext.partition("===!")[2]
    if extraCode:
        for utKeyword in ["assert", "unittest", "TEST_CASE", "junit"]:
            if utKeyword in extraCode:
                return "unittest"

    if "===iotests===" in dbtext:
        return "unittest"

    return ""


def _fix_image_urls(dbtext, db_context, course_name):
    """Fix image URLs in the content to be relative to the book."""
    dbtext = db_context["ext_img_patt"].sub(
        f"""src="/ns/books/published/{course_name}/external""", dbtext
    )
    dbtext = db_context["gen_img_patt"].sub(
        f"""src="/ns/books/published/{course_name}/generated""", dbtext
    )
    return dbtext


def _upsert_question(sess, db_context, namekey, valudict, course_name):
    """Insert or update a question in the database."""
    res = sess.execute(
        text(
            f"select * from questions where name='{namekey}' and base_course='{course_name}'"
        )
    ).first()

    if res:
        # delete name and base_course from valudict to avoid conflicts
        valudict.pop("name", None)
        valudict.pop("base_course", None)
        # Update existing question
        result_id = res.id
        ins = (
            db_context["questions"]
            .update()
            .where(
                and_(
                    db_context["questions"].c.name == namekey,
                    db_context["questions"].c.base_course == course_name,
                )
            )
            .values(**valudict)
        )
        sess.execute(ins)
    else:
        ins = db_context["questions"].insert().values(**valudict)
        res = sess.execute(ins)
        result_id = res.inserted_primary_key[0]

    return result_id


def _handle_datafile(el, course_name):
    """Handle datafile-specific processing."""
    if "data-isimage" in el.attrib:
        file_contents = el.attrib["src"]
        if file_contents.startswith("data:"):
            file_contents = file_contents.split("base64,")[1]
    else:
        file_contents = el.text

    filename = el.attrib.get("data-filename", el.attrib["id"])
    id = el.attrib["id"]

    update_source_code_sync(
        acid=id,
        course_id=course_name,
        main_code=file_contents,
        filename=filename,
    )


def _process_source_elements(sess, subchapter, course_name):
    """Process source elements in a subchapter."""
    for sourceEl in subchapter.findall("./source"):
        id = sourceEl.attrib["id"]
        file_contents = sourceEl.text
        filename = sourceEl.attrib.get("filename", sourceEl.attrib["id"])

        update_source_code_sync(
            acid=id,
            course_id=course_name,
            main_code=file_contents,
            filename=filename,
        )


def _set_course_attributes(sess, db_context, course_name, manifest_path):
    """Set course attributes from the manifest."""
    tree = ET.parse(manifest_path)
    root = tree.getroot()

    latex = root.find("./latex-macros")
    rslogger.info("Setting attributes for this base course")

    ww_meta = root.find("./webwork-version")
    if ww_meta is not None:
        ww_major = ww_meta.attrib["major"]
        ww_minor = ww_meta.attrib["minor"]
    else:
        ww_major = None
        ww_minor = None

    res = sess.execute(
        text(f"select * from courses where course_name ='{course_name}'")
    ).first()
    cid = res.id

    # Delete and recreate specific attributes
    to_delete = ["latex_macros", "markup_system"]
    if ww_major:
        to_delete.extend(["webwork_js_version", "ptx_js_version"])

    sess.execute(
        db_context["course_attributes"]
        .delete()
        .where(
            and_(
                db_context["course_attributes"].c.course_id == cid,
                db_context["course_attributes"].c.attr.in_(to_delete),
            )
        )
    )

    # Insert new attributes
    if ww_major:
        ins = (
            db_context["course_attributes"]
            .insert()
            .values(
                course_id=cid, attr="webwork_js_version", value=f"{ww_major}.{ww_minor}"
            )
        )
        sess.execute(ins)
        ins = (
            db_context["course_attributes"]
            .insert()
            .values(course_id=cid, attr="ptx_js_version", value="0.3")
        )
        sess.execute(ins)

    if latex is not None:
        ins = (
            db_context["course_attributes"]
            .insert()
            .values(course_id=cid, attr="latex_macros", value=latex.text)
        )
        sess.execute(ins)

    ins = (
        db_context["course_attributes"]
        .insert()
        .values(course_id=cid, attr="markup_system", value="PreTeXt")
    )
    sess.execute(ins)


class StringIOHandler(logging.Handler):
    """
    A custom logging handler that captures log entries in a StringIO buffer.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.stream = StringIO()

    def emit(self, record):
        """
        Emit a record by writing to the StringIO buffer.
        """
        msg = self.format(record)
        self.stream.write(msg + "\n")

    def getvalue(self):
        """
        Return the contents of the StringIO buffer as a string.
        """
        return self.stream.getvalue()

    def flush(self):
        """
        Flush the StringIO buffer.
        """
        self.stream.flush()
