# ***********************************
# |docname| - Serve pages from a book
# ***********************************
"""
Overview
--------
This module contains the router for serving pages from a book. It also contains the code for serving the library page.

The following routes are defined:

* ``/published/<book_name>/<page_name>`` - Serve a page from a book
* ``/index/<book_name>/`` - Serve the library page

Detailed Module Description
---------------------------

"""
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
from datetime import datetime, timedelta
import json
import os
import os.path
import posixpath
import random
import socket
from typing import Optional

# Third-party imports
# -------------------
from fastapi import APIRouter, Cookie, Request, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from jinja2.exceptions import TemplateNotFound
from pydantic import StringConstraints

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from rsptx.configuration import settings
from rsptx.db.crud import (
    create_useinfo_entry,
    fetch_chapter_for_subchapter,
    fetch_course,
    fetch_library_book,
    fetch_library_books,
    fetch_page_activity_counts,
    fetch_reading_assignment_spec,
    fetch_all_course_attributes,
    fetch_subchapters,
    get_courses_per_basecourse,
    get_students_per_basecourse,
)
from rsptx.db.models import UseinfoValidation
from rsptx.auth.session import is_instructor
from rsptx.templates import template_folder
from rsptx.response_helpers.core import canonical_utcnow
from typing_extensions import Annotated

# .. _APIRouter config:
#
# Routing
# =======
# Setup the router object for the endpoints defined in this file.  These will
# be `connected <included routing>` to the main application in `../main.py`.
router = APIRouter(
    # shortcut so we don't have to repeat this part
    prefix="/books",
    # groups all logger `tags <https://fastapi.tiangolo.com/tutorial/path-operation-configuration/#tags>`_ together in the docs.
    tags=["books"],
)


# Options for static asset renderers:
#
# - `StaticFiles <https://fastapi.tiangolo.com/tutorial/static-files/?h=+staticfiles#use-staticfiles>`_. However, this assumes the static routes are known *a priori*, in contrast to books (with their static assets) that are dynamically added and removed.
# - Manually route static files, returning them using a `FileResponse <https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse>`_. This is the approach taken.
#
# for paths like: ``/books/published/basecourse/_static/rest``.
# If it is fast and efficient to handle it here it would be great.  We currently avoid
# any static file contact with web2py and handle static files upstream with nginx directly; therefore, this is useful only for testing/a non-production environment.
# Note the use of the ``path``` type for filepath in the decoration.  If you don't use path it
# seems to only get you the ``next`` part of the path ``/pre/vious/next/the/rest``.
#


# TODO: make published/draft configurable
async def return_static_asset(course: str, kind: str, filepath: str):
    """Return a static asset from a book.  These are typically images, css, or js files. they do not require any special processing or use of templates.

    :param course: The name of the course
    :type course: str
    :param kind: What kind of assset is it?
    :type kind: str
    :param filepath: The path to the file
    :type filepath: str
    :raises HTTPException:
    :return: Response object
    """
    # Get the course row so we can use the base_course
    # We would like to serve book pages with the actual course name in the URL
    # instead of the base course.  This is a necessary step.
    course_row = await fetch_course(course)
    if not course_row:
        raise HTTPException(404)

    filepath = safe_join(
        settings.book_path,
        course_row.base_course,
        "published",
        course_row.base_course,
        kind,
        filepath,
    )
    headers = {"Cache-Control": "public, max-age=630000"}
    rslogger.debug(f"GETTING: {filepath}")
    if os.path.exists(filepath) and not os.path.isdir(filepath):
        return FileResponse(filepath, headers=headers)
    else:
        raise HTTPException(404)


# Runestone academy supported several additional static folders:
# _static|_images|images|_downloads|generated|external
# There must be a better solution than duplicating this code X times
# there is probabaly some fancy decorator trick but this is quick and easy.
# TODO: **Routes for draft (instructor-only) books.**


@router.get("/published/{course:str}/_images/{filepath:path}")
async def get_image(course: str, filepath: str):
    return await return_static_asset(course, "_images", filepath)


@router.get("/published/{course:str}/_static/{filepath:path}")
async def get_static(course: str, filepath: str):
    return await return_static_asset(course, "_static", filepath)


# PreTeXt books put images in images not _images -- oh for regexes in routes!
@router.get("/published/{course:str}/images/{filepath:path}")
async def get_ptximages(course: str, filepath: str):
    return await return_static_asset(course, "images", filepath)


# Umich book uses the _downloads folder and ``:download:`` role
@router.get("/published/{course:str}/_downloads/{filepath:path}")
async def get_downloads(course: str, filepath: str):
    return await return_static_asset(course, "_downloads", filepath)


# PreTeXt
@router.get("/published/{course:str}/generated/{filepath:path}")
async def get_generated(course: str, filepath: str):
    return await return_static_asset(course, "generated", filepath)


# PreTeXt
@router.get("/published/{course:str}/external/{filepath:path}")
async def get_external(course: str, filepath: str):
    return await return_static_asset(course, "external", filepath)


# Jupyterlite
@router.get("/published/{course:str}/lite/{filepath:path}")
async def get_jlite(course: str, filepath: str):
    rslogger.debug(f"Getting {filepath} but adding index.html")
    if filepath[-1] == "/":
        filepath += "index.html"
    return await return_static_asset(course, "lite", filepath)


# Basic page renderer
# ===================
# To see the output of this endpoint, see http://localhost:8080/books/published/overview/index.html.
# the course_name in the uri is the actual course name, not the base course, as was previously
# the case. This should help eliminate the accidental work in the base course problem, and allow
# teachers to share links to their course with the students.
@router.api_route(
    "/published/{course_name:str}/{pagepath:path}",
    methods=["GET", "POST"],
    response_class=HTMLResponse,
)
async def serve_page(
    request: Request,
    course_name: Annotated[str, StringConstraints(max_length=512)],  # type: ignore
    pagepath: Annotated[str, StringConstraints(max_length=512)],  # type: ignore
    RS_info: Optional[str] = Cookie(None),
    mode: Optional[str] = None,
):
    """Serve a page from a book.

    Book pages are not static, they are generated on the fly.  When you build a book, ptx or runestone bulds the pages of the book as Jinja2 templates.  This endpoint serves those pages by gathering data from the database and passing it to the template. Some key parts of the template include:

    * course attributes
    * user information
    * whether to serve an ad or not
    * whether to ask for a donation or not
    * the subchapter navigation menu
    * the page content

    .. note:: Caution
        Anyone modifying this function should exercise caution.  It is the core of the Runestone server and is used by all books.   It is called hundreds of thousands of times a day so performance is critical.

    :param request: A FastAPI request object
    :type request: Request
    :param course_name: The name of the course (part of the URL)
    :type course_name: constr, optional
    :param pagepath: The path to the page (part of the URL)
    :type pagepath: constr, optional
    :param RS_info: An RS_info cookie, defaults to None
    :type RS_info: Optional[str], optional
    :param mode: _description_, defaults to None
    :type mode: Optional[str], optional
    :raises HTTPException: _description_
    :return: response object
    :rtype: Response
    """

    if mode and mode == "browsing":
        use_services = False
        user = None
    else:
        use_services = True
        user = request.state.user
        rslogger.debug(f"user = {user}, course name = {course_name}")
    # Make sure this course exists, and look up its base course.
    # Since these values are going to be read by javascript we
    # need to use lowercase true and false.
    if user:
        logged_in = "true"
        user_is_instructor = await is_instructor(request)
        serve_ad = False
    else:
        logged_in = "false"
        activity_info = {}
        user_is_instructor = False
        serve_ad = True

    course_row = await fetch_course(course_name)
    # check for some error conditions
    if not course_row:
        return RedirectResponse(
            url=f"/runestone/default/courses?bad_course={course_name}", status_code=307
        )
    else:
        # The course requires a login but the user is not logged in
        if course_row.login_required and not user:
            rslogger.debug(f"User not logged in: {course_name} redirect to login")
            return RedirectResponse(url="/runestone/default/accessIssue")

        # The user is logged in, but their "current course" is not this one.
        # Send them to the courses page so they can properly switch courses.
        if user and user.course_name != course_name:
            user_course_row = await fetch_course(user.course_name)
            rslogger.debug(
                f"Course mismatch: course name: {user.course_name} does not match requested course: {course_name} redirecting"
            )
            if user_course_row.base_course == course_name:
                return RedirectResponse(
                    url=f"/ns/books/published/{user.course_name}/{pagepath}"
                )
            return RedirectResponse(
                url=f"/runestone/default/courses?requested_course={course_name}&current_course={user.course_name}&requested_path={pagepath}"
            )
    # proceed with the knowledge that course_row is defined after this point.

    # The template path comes from the base course's name.
    templates = Jinja2Templates(
        directory=safe_join(
            settings.book_path,
            course_row.base_course,
            "published",
            course_row.base_course,
        ),
    )
    course_attrs = await fetch_all_course_attributes(course_row.id)
    # course_attrs will always return a dictionary, even if an empty one.
    rslogger.debug(f"HEY COURSE ATTRS: {course_attrs}")
    # TODO set custom delimiters for PreTeXt books (https://stackoverflow.com/questions/33775085/is-it-possible-to-change-the-default-double-curly-braces-delimiter-in-polymer)
    # Books built with lots of LaTeX math in them are troublesome as they tend to have many instances
    # of ``{{`` and ``}}`` which conflicts with the default Jinja2 start stop delimiters. Rather than
    # escaping all of the latex math the PreTeXt built books use different delimiters for the templates
    # templates.env is a reference to a Jinja2 Environment object
    # try - templates.env.block_start_string = "@@@+"
    # try - templates.env.block_end_string = "@@@-"

    if course_attrs.get("markup_system", "RST") == "PreTeXt":
        rslogger.debug(f"PRETEXT book found at path {pagepath}")
        templates.env.variable_start_string = "~._"
        templates.env.variable_end_string = "_.~"
        templates.env.comment_start_string = "@@#"
        templates.env.comment_end_string = "#@@"
        templates.env.globals.update({"URL": URL})
    # rslogger.debug(f"template cache size {templates.env.cache_size}")

    # enable compare me can be set per course if its not set provide a default of true
    if "enable_compare_me" not in course_attrs:
        course_attrs["enable_compare_me"] = "true"

    subchapter = os.path.basename(os.path.splitext(pagepath)[0])
    rslogger.debug(f"SUBCHAPTER IS {subchapter}")
    if course_attrs.get("markup_system", "RST") == "PreTeXt":
        chapter = await fetch_chapter_for_subchapter(subchapter, course_row.base_course)
    else:
        chapter = os.path.split(os.path.split(pagepath)[0])[1]

    rslogger.debug(f"CHAPTER IS {chapter} / {subchapter}")
    if user:
        activity_info = await fetch_page_activity_counts(
            chapter, subchapter, course_row.base_course, course_name, user.username
        )
        if not course_row.timezone:
            if RS_info:
                tz = json.loads(RS_info).get("timezone", "UTC")
            else:
                tz = "UTC"
        else:
            tz = course_row.timezone
        assignment__spec = await fetch_reading_assignment_spec(
            chapter, subchapter, course_row.id, timezone=tz
        )
        if assignment__spec:
            activity_info["assignment_spec"] = dict(**assignment__spec._mapping)

    reading_list = []
    if RS_info:
        try:
            values = json.loads(RS_info)
            if "readings" in values:
                reading_list = values["readings"]
        except Exception as e:
            rslogger.error(f"Error parsing RS_info: {e} Cookie: {RS_info}")

    #   TODO: provide the template google_ga as well as ad servings stuff
    #   settings.google_ga
    await create_useinfo_entry(
        UseinfoValidation(
            event="page",
            act="view",
            div_id=pagepath,
            course_id=course_name,
            sid=user.username if user else "Anonymous",
            timestamp=canonical_utcnow(),
        )
    )
    if "LOAD_BALANCER_HOST" in os.environ:
        canonical_host = os.environ["LOAD_BALANCER_HOST"]
    else:
        canonical_host = os.environ.get("RUNESTONE_HOST", "localhost")

    subchapter_list = await fetch_subchaptoc(course_row.base_course, chapter)
    # TODO: restore the contributed questions list ``questions`` for books (only fopp) that
    # show the contributed questions list on an Exercises page.

    # Determine if we should ask for support
    # Trying to do banner ads after the 2nd week of the term
    # but not to high school students or if the instructor has donated for the course
    now = canonical_utcnow().date()
    week2 = timedelta(weeks=2)
    if (
        now >= (course_row.term_start_date + week2)
        and course_row.base_course != "csawesome"
        and course_row.base_course != "mobilecsp"
        and course_row.courselevel != "high"
        and course_row.course_name != course_row.base_course
        and not course_row.is_supporter
    ):
        show_rs_banner = True
    elif course_row.course_name == course_row.base_course and random.random() <= 0.3:
        # Show banners to base course users 30% of the time.
        show_rs_banner = True
    else:
        show_rs_banner = False
    rslogger.debug(f"Before user check rs_banner is {show_rs_banner}")

    if user and user.donated:
        show_rs_banner = False
    rslogger.debug(f"After user check rs_banner is {show_rs_banner}")

    worker_name = os.environ.get("WORKER_NAME", socket.gethostname())
    if worker_name == "":
        worker_name = socket.gethostname()

    # This makes serving ethical ads the default, but it can be overridden
    # by adding a course attribute for the base course to set the ad_server to google
    if course_attrs.get("ad_server", "ethical") == "ethical":
        serve_google_ad = False
    else:
        serve_google_ad = serve_ad

    # If the pagepath is empty, we want to serve the default main_page
    if pagepath.strip() == "":
        lib_entry = await fetch_library_book(course_row.base_course)
        pagepath = lib_entry.main_page if lib_entry else "index.html"

    headers = {"Cache-Control": "no-cache, no-store, must-revalidate"}
    context = dict(
        request=request,
        course_name=course_name,
        base_course=course_row.base_course,
        user_id=user.username if user else "",
        # _`root_path`: The server is mounted in a different location depending on how it's run (directly from gunicorn/uvicorn or under the ``/ns`` prefix using nginx). Tell the JS what prefix to use for Ajax requests. See also `setting root_path <setting root_path>` and the `FastAPI docs <https://fastapi.tiangolo.com/advanced/behind-a-proxy/>`_. This is then used in the ``eBookConfig`` of :doc:`runestone/common/project_template/_templates/plugin_layouts/sphinx_bootstrap/layout.html`.
        # new_server_prefix=request.scope.get("root_path"),
        # todo: the above doesn't work in the new configuration because we strip off the /ns
        # when we are using docker compose... We need a way to know when we are running in docker compose and when we are not... an environment variable probably
        new_server_prefix=(
            "/ns"
            if os.environ.get("DOCKER_COMPOSE", False)
            else request.scope.get("root_path")
        ),
        user_email=user.email if user else "",
        downloads_enabled="true" if course_row.downloads_enabled else "false",
        allow_pairs="true" if course_row.allow_pairs else "false",
        activity_info=json.dumps(activity_info),
        settings=settings,
        is_logged_in=logged_in,
        subchapter_list=subchapter_list,
        serve_ad=serve_google_ad,
        is_instructor="true" if user_is_instructor else "false",
        use_services="true" if use_services else "false",
        readings=reading_list,
        pagepath=pagepath,
        canonical_host=canonical_host,
        show_rs_banner=show_rs_banner,
        show_ethical_ad=serve_ad,
        worker_name=worker_name,
        appname="runestone",  # for peer+ links
        **course_attrs,
    )
    # See `templates <https://fastapi.tiangolo.com/advanced/templates/>`_.
    try:
        return templates.TemplateResponse(pagepath, context, headers=headers)
    except TemplateNotFound:
        return RedirectResponse(
            url=f"/runestone/default/courses?bad_course={pagepath}", status_code=307
        )


@router.get("/crashtest")
async def crashme():
    a = 10
    b = 11  # noqa
    c = a / (11 - 11)  # noqa


# The Library Page
# ================


@router.api_route("/index", methods=["GET", "POST"])
async def library(request: Request, response_class=HTMLResponse):
    """
    Create the library page from the Library database table.

    :param request: The FastAPI request object.
    :type request: Request
    :param response_class: defaults to HTMLResponse
    :type response_class: _type_, optional
    :return: HTMLResponse
    :rtype: HTMLResponse
    """
    books = await fetch_library_books()
    students = await get_students_per_basecourse()
    courses = await get_courses_per_basecourse()
    books = sorted(books, key=lambda x: students.get(x.basecourse, 0), reverse=True)
    sections = set()
    for book in books:
        if book.shelf_section is None:
            book.shelf_section = "Misc"
        if book.shelf_section not in sections:
            sections.add(book.shelf_section)

    user = request.state.user
    if user:
        course = await fetch_course(user.course_name)
        username = user.username
        instructor_status = await is_instructor(request)
    else:
        course = ""
        username = ""
        instructor_status = False
    templates = Jinja2Templates(directory=f"{template_folder}")
    sorted_sections = list(sections)
    try:
        sorted_sections.sort()
    except Exception as e:
        rslogger.error(f"Error sorting sections: {e}")
    return templates.TemplateResponse(
        "book/index.html",
        {
            "request": request,
            "book_list": books,
            "sections": sorted_sections,
            "course": course,
            "user": username,
            "is_instructor": instructor_status,
            "students": students,
            "courses": courses,
        },
    )


# Utilities
# =========
# This is copied verbatim from https://github.com/pallets/werkzeug/blob/master/werkzeug/security.py#L30.
_os_alt_seps = list(
    sep for sep in [os.path.sep, os.path.altsep] if sep not in (None, "/")
)


def URL(*argv):
    return "/".join(argv)


def XML(arg):
    return arg


# This is copied verbatim from https://github.com/pallets/werkzeug/blob/master/werkzeug/security.py#L216.
def safe_join(directory, *pathnames):
    """Safely join ``directory`` and one or more untrusted ``pathnames``.  If this
    cannot be done, this function returns ``None``.  The main thing this does is make sure that we do not allow relative pathnames going up the directory tree to be joined to the base directory.  This is important because it prevents an attacker from using a pathname like ``../../../etc/passwd`` to read an arbitrary file on the server filesystem.

    :param directory: the base directory.
    :param pathnames: the untrusted pathnames relative to that directory.
    :return: the joined path or ``None`` if this cannot be done.
    """
    parts = [directory]
    for filename in pathnames:
        if filename != "":
            filename = posixpath.normpath(filename)
        for sep in _os_alt_seps:
            if sep in filename:
                return None
        if os.path.isabs(filename) or filename == ".." or filename.startswith("../"):
            return None
        parts.append(filename)
    return posixpath.join(*parts)


async def fetch_subchaptoc(course: str, chap: str):
    res = await fetch_subchapters(course, chap)
    toclist = []
    for row in res:
        rslogger.debug(f"row = {row}")
        sc_url = f"{row[0]}.html"
        title = row[1]
        toclist.append(dict(subchap_uri=sc_url, title=title))

    return toclist
