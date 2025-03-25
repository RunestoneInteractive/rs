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
from lxml import ElementInclude
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
from rsptx.response_helpers.core import canonical_utcnow
import pdb

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
            return False
    except ImportError as e:
        click.echo("You do not appear to have a good pavement.py file.")
        print(e)
        return False

    # If the click object has a worker attribute then we are running in a worker
    # process and **know** we are making a build for a runestone server. In that
    # case we need to make sure that the dynamic_pages flag is set to True in
    # pavement.py
    if hasattr(click, "worker") and paver_vars["dynamic_pages"] is not True:
        click.echo("dynamic_pages must be set to True in pavement.py")
        return False
    if paver_vars["project_name"] != course:
        click.echo(
            f"Error: {course} and {paver_vars['project_name']} do not match.  Your course name needs to match the project_name in pavement.py"
        )
        return False
    if paver_vars["options"].build.template_args["basecourse"] != course:
        click.echo(
            f"Error: {course} and {paver_vars['options'].build.template_args['basecourse']} do not match.  Your course name needs to match the basecourse in pavement.py"
        )
        return False

    click.echo("Running runestone build --all")
    res = subprocess.run("runestone build --all", shell=True, capture_output=True)
    with open("cli.log", "wb") as olfile:
        olfile.write(res.stdout)
        olfile.write(b"\n====\n")
        olfile.write(res.stderr)

    if res.returncode != 0:
        click.echo(
            f"building the book failed {res}, check the log for errors and try again"
        )
        return False
    click.echo("Build succeedeed... Now deploying to published")
    if paver_vars["dest"] != "./published":
        click.echo(
            "Incorrect deployment directory.  dest should be ./published in pavement.py"
        )
        return False

    resd = subprocess.run("runestone deploy", shell=True, capture_output=True)
    with open("cli.log", "ab") as olfile:
        olfile.write(res.stdout)
        olfile.write(b"\n====\n")
        olfile.write(res.stderr)
    if resd.returncode == 0:
        click.echo("Success! Book deployed")
    else:
        click.echo("Deploy failed, check the log to see what went wrong.")
        return False

    update_library(config, "", course, click, build_system="Runestone")
    return True


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
        return False
    else:
        click.echo("Checking files")
        if not target:
            target = "runestone"
        # sets output_dir to `published/<course>`
        # and {"host-platform": "runestone"} in stringparams
        rs = check_project_ptx(course=course, target=target)
        if not rs:
            return False

        logger = logging.getLogger("ptxlogger")
        string_io_handler = StringIOHandler()
        logger.addHandler(string_io_handler)
        click.echo("Building the book")

        rs.build()  # build the book, generating assets as needed
        log_path = Path(os.environ.get("BOOK_PATH")) / rs.output_dir / "cli.log"
        if not log_path.parent.exists():
            log_path.parent.mkdir(parents=True, exist_ok=True)
        click.echo(f"Writing log to {log_path}")
        with open(log_path, "a") as olfile:
            olfile.write(string_io_handler.getvalue())

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
                return False
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
        return True


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
    else:
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

    try:
        res = eng.execute(f"select * from library where basecourse = '{course}'")
    except Exception:
        click.echo("Missing library table?  You may need to run an alembic migration.")
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
    meta = MetaData()
    chapters = Table("chapters", meta, autoload=True, autoload_with=engine)
    subchapters = Table("sub_chapters", meta, autoload=True, autoload_with=engine)
    questions = Table("questions", meta, autoload=True, autoload_with=engine)
    source_code = Table("source_code", meta, autoload=True, autoload_with=engine)
    course_attributes = Table(
        "course_attributes", meta, autoload=True, autoload_with=engine
    )

    rslogger.info(f"Cleaning up old chapters info for {course_name}")
    # Delete the chapter rows before repopulating. Subchapter rows are taken
    # care of by postgres with the ON DELETE CASCADE clause

    sess.execute(chapters.delete().where(chapters.c.course_id == course_name))

    # Mark existing questions as from_source = 'F' all questions in the manifest will be updated
    # and marked as from_source = 'T' if they are in the manifest.
    sess.execute(
        questions.update()
        .where(questions.c.base_course == course_name)
        .values(from_source="F")
    )

    rslogger.info("Populating the database with Chapter information")
    ext_img_patt = re.compile(r"""src="external""")
    gen_img_patt = re.compile(r"""src="generated""")

    tree = ET.parse(manifest_path)
    root = tree.getroot()
    chap = 0
    for chapter in root.findall("./chapter"):
        rslogger.info(chapter)
        chap += 1
        rslogger.debug(
            f"{chapter.tag} {chapter.find('./id').text} {chapter.find('./title').text}"
        )
        ins = chapters.insert().values(
            chapter_name=chapter.find("./title").text,
            course_id=course_name,
            chapter_label=chapter.find("./id").text,
            chapter_num=chap,
        )
        res = sess.execute(ins)
        chapid = res.inserted_primary_key[0]
        subchap = 0
        #  sub_chapter_name   | character varying(512)
        #  chapter_id         | integer
        #  sub_chapter_label  | character varying(512)
        #  skipreading        | character(1)
        #  sub_chapter_num    | integer
        for subchapter in chapter.findall("./subchapter"):
            subchap += 1

            chap_xmlid = subchapter.find("./id").text
            rslogger.debug(f"subchapter {chap_xmlid}")
            if not chap_xmlid:
                rslogger.error(f"Missing id tag in subchapter {subchapter}")

            titletext = subchapter.find("./title").text
            if not titletext:
                rslogger.debug(f"constructing title for subchapter {chap_xmlid}")
                # ET.tostring  converts the tag and everything to text
                # el.text gets the text inside the element
                titletext = " ".join(
                    [
                        ET.tostring(y).decode("utf8")
                        for y in subchapter.findall("./title/*")
                    ]
                )
            ins = subchapters.insert().values(
                sub_chapter_name=titletext,
                chapter_id=chapid,
                sub_chapter_label=subchapter.find("./id").text,
                skipreading="F",
                sub_chapter_num=subchap,
            )
            sess.execute(ins)

            # Now add this chapter / subchapter to the questions table as a page entry
            name = f"{chapter.find('./title').text}/{subchapter.find('./title').text}"
            res = sess.execute(
                text(
                    """select * from questions where name = :name and base_course = :course_name"""
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
            )
            if res:
                ins = (
                    questions.update()
                    .where(
                        and_(
                            questions.c.name == name,
                            questions.c.base_course == course_name,
                        )
                    )
                    .values(**valudict)
                )
            else:
                ins = questions.insert().values(**valudict)
            sess.execute(ins)

            for question in subchapter.findall("./question"):
                dbtext = " ".join(
                    [
                        ET.tostring(y).decode("utf8")
                        for y in question.findall("./htmlsrc/*")
                    ]
                )
                qlabel = " ".join([y.text for y in question.findall("./label")])
                rslogger.debug(f"found label= {qlabel}")
                rslogger.debug("looking for data-component")
                # pdb.set_trace()

                el = question.find(".//*[@data-component]")
                old_ww_id = None
                # Unbelievably if find finds something it evals to False!!
                if el is not None:
                    if "id" in el.attrib:
                        idchild = el.attrib["id"]
                    else:
                        idchild = "fix_me"
                    if "the-id-on-the-webwork" in el.attrib:
                        old_ww_id = el.attrib["the-id-on-the-webwork"]
                else:
                    el = question.find("./div")
                    if el is None:
                        idchild = "fix_me"
                        rslogger.error(
                            f"no id found for question: \n{ET.tostring(question).decode('utf8')}"
                        )
                    elif "id" in el.attrib:
                        idchild = el.attrib["id"]
                    else:
                        idchild = "fix_me"
                try:
                    qtype = el.attrib["data-component"]
                    if qtype == "codelens":
                        # pdb.set_trace()
                        id_el = el.find("./*[@class='pytutorVisualizer']")
                        idchild = id_el.attrib["id"]
                    # translate qtype to question_type
                    qtype = QT_MAP.get(qtype, qtype)
                except Exception:
                    if el is not None:
                        qtype = "webwork"
                        dbtext = ET.tostring(el).decode("utf8")

                if "optional" in question.attrib or qtype == "datafile":
                    optional = "T"
                else:
                    optional = "F"
                practice = "F"
                if qtype == "webwork":
                    practice = "T"
                if el and "practice" in el.attrib:
                    practice = "T"
                autograde = ""
                if "====" in dbtext:
                    extraCode = dbtext.partition("====")[2]  # text after ====
                    # keywords for sql, py, cpp, java respectively
                    for utKeyword in ["assert", "unittest", "TEST_CASE", "junit"]:
                        if utKeyword in extraCode:
                            autograde = "unittest"
                            break
                # chapter and subchapter are elements
                # fix image urls in dbtext to be relative to the book
                dbtext = ext_img_patt.sub(
                    f"""src="/ns/books/published/{course_name}/external""", dbtext
                )
                dbtext = gen_img_patt.sub(
                    f"""src="/ns/books/published/{course_name}/generated""", dbtext
                )
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
                )
                if old_ww_id:
                    namekey = old_ww_id
                else:
                    namekey = idchild
                res = sess.execute(
                    f"""select * from questions where name='{namekey}' and base_course='{course_name}'"""
                ).first()
                if res:
                    ins = (
                        questions.update()
                        .where(
                            and_(
                                questions.c.name == namekey,
                                questions.c.base_course == course_name,
                            )
                        )
                        .values(**valudict)
                    )
                else:
                    ins = questions.insert().values(**valudict)
                sess.execute(ins)
                if qtype == "datafile":
                    if "data-isimage" in el.attrib:
                        file_contents = el.attrib["src"]
                        if file_contents.startswith("data:"):
                            file_contents = file_contents.split("base64,")[1]
                    else:
                        file_contents = el.text
                    if "data-filename" in el.attrib:
                        filename = el.attrib["data-filename"]
                    else:
                        filename = el.attrib["id"]

                    # write datafile contents to the source_code table
                    res = res = sess.execute(
                        f"""select * from source_code where acid='{filename}' and course_id='{course_name}'"""
                    ).first()

                    vdict = dict(
                        acid=filename, course_id=course_name, main_code=file_contents
                    )
                    if res:
                        upd = (
                            source_code.update()
                            .where(
                                and_(
                                    source_code.c.acid == filename,
                                    source_code.c.course_id == course_name,
                                )
                            )
                            .values(**vdict)
                        )
                    else:
                        upd = source_code.insert().values(**vdict)
                    sess.execute(upd)

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
        f"select * from courses where course_name ='{course_name}'"
    ).first()
    cid = res["id"]

    # Only delete latex_macros and markup_system if they are present. Leave other attributes alone.
    to_delete = ["latex_macros", "markup_system"]
    if ww_major:
        to_delete.append("webwork_js_version")
        to_delete.append("ptx_js_version")
    sess.execute(
        course_attributes.delete().where(
            and_(
                course_attributes.c.course_id == cid,
                course_attributes.c.attr.in_(to_delete),
            )
        )
    )
    if ww_major:
        ins = course_attributes.insert().values(
            course_id=cid, attr="webwork_js_version", value=f"{ww_major}.{ww_minor}"
        )
        ins = course_attributes.insert().values(
            course_id=cid, attr="ptx_js_version", value="0.3"
        )

    ins = course_attributes.insert().values(
        course_id=cid, attr="latex_macros", value=latex.text
    )
    sess.execute(ins)
    ins = course_attributes.insert().values(
        course_id=cid, attr="markup_system", value="PreTeXt"
    )
    sess.execute(ins)
    sess.commit()


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
