# ****************************************
# |docname| - web ui endponits for authors
# ****************************************
#
# / - See home
# /logfiles
# /impact
# /anonymize_data
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import os
import pathlib
import datetime
import logging
import sys
import time

# third party
# -----------
import aiofiles
from fastapi import Body, FastAPI, Form, Request, Depends, status
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from celery.result import AsyncResult
import pandas as pd
from sqlalchemy import create_engine, Table, MetaData, select, and_, or_
from sqlalchemy.sql import text
from sqlalchemy.orm.session import sessionmaker
from fastapi_login import LoginManager

# Local App
# ---------
from rsptx.forms import LibraryForm, DatashopForm
from rsptx.author_server_api.worker import (
    build_runestone_book,
    clone_runestone_book,
    build_ptx_book,
    deploy_book,
    useinfo_to_csv,
    code_to_csv,
    anonymize_data_dump,
)
from rsptx.db.models import (
    Session,
    auth_user,
    courses,
    BookAuthor,
    library,
    course_instructor,
)
from rsptx.visualization.authorImpact import (
    get_enrollment_graph,
    get_pv_heatmap,
    get_subchap_heatmap,
    get_course_graph,
)
from runestone.server.utils import update_library

logger = logging.getLogger("runestone")
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter("%(levelname)s: %(asctime)s:  %(funcName)s: %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# make sure to set this in production
secret = os.environ.get("JWT_SECRET", "supersecret")
auth_manager = LoginManager(secret, "/auth/validate", use_cookie=True)
auth_manager.cookie_name = "access_token"


@auth_manager.user_loader()  # type: ignore
def _load_user(user_id: str):
    """
    fetch a user object from the database. This is designed to work with the
    original web2py auth_user schema but make it easier to migrate to a new
    database by simply returning a user object.
    """

    return fetch_user(user_id)


def fetch_user(user_id: str):
    # Create an AuthUser object from the databae metadata
    sel = select([auth_user]).where(auth_user.c.username == user_id)
    with Session() as sess:
        res = sess.execute(sel).first()
        # res is a SqlAlchemy Row - you can access columns by position or by name
        print(f"RES = {res}")
        return res


def fetch_books_by_author(author: str):
    query = (
        select(library, BookAuthor)
        .join(BookAuthor, BookAuthor.book == library.c.basecourse)
        .where(BookAuthor.author == author)
        .order_by(BookAuthor.book)
    )
    with Session() as sess:
        res = sess.execute(query).fetchall()
        for row in res:
            print("ROW is ", row.title)
        return res


def create_book_entry(author: str, document_id: str, github: str):
    # need to create a library entry first.
    course_stmt = courses.insert().values(
        base_course=document_id,
        course_name=document_id,
        python3="T",
        term_start_date="2022-01-01",
        login_required="F",
        institution="Runestone",
        courselevel="",
        downloads_enabled="F",
        allow_pairs="F",
        new_server="T",
    )
    vals = {"authors": author, "basecourse": document_id, "github_url": github}
    vals["title"] = document_id
    stmt = library.insert().values(**vals)

    new_ba = BookAuthor(author=author, book=document_id)
    # Now execute all of the statments in a single transaction.
    with Session.begin() as session:
        session.execute(course_stmt)
        session.execute(stmt)
        session.add(new_ba)


# Install the auth_manager as middleware This will make the user
# part of the request ``request.state.user`` `See FastAPI_Login Advanced <https://fastapi-login.readthedocs.io/advanced_usage/>`_
auth_manager.useRequest(app)


@app.get("/")
async def home(request: Request, user=Depends(auth_manager)):
    print(f"{request.state.user} OR user = {user}")

    if user:
        if not verify_author(user):
            return RedirectResponse(url="/notauthorized")

    if user:
        name = user.first_name
        book_list = fetch_books_by_author(user.username)

    else:
        name = "unknown person"
        book_list = []
        # redirect them back somewhere....

    return templates.TemplateResponse(
        "home.html", context={"request": request, "name": name, "book_list": book_list}
    )


@app.get("/logfiles")
async def logfiles(request: Request, user=Depends(auth_manager)):
    if verify_instructor(user):

        lf_path = pathlib.Path("logfiles", user.username)
        logger.debug(f"WORKING DIR = {lf_path}")
        if lf_path.exists():
            ready_files = {
                x: str(
                    time.strftime(
                        "%Y-%m-%d %H:%M;%S", time.localtime(x.stat().st_mtime)
                    )
                )
                for x in lf_path.iterdir()
            }
        else:
            ready_files = []
        logger.debug(f"{ready_files=}")
        return templates.TemplateResponse(
            "logfiles.html",
            context=dict(
                request=request,
                ready_files=ready_files,
                course_name=user.course_name,
                username=user.username,
            ),
        )
    else:
        return RedirectResponse(url="/notauthorized")


@app.get("/getfile/{fname}")
async def getfile(request: Request, fname: str, user=Depends(auth_manager)):
    file_path = pathlib.Path("logfiles", user.username, fname)
    return FileResponse(file_path)


@app.get("/getdatashop/{fname}")
async def getfile(request: Request, fname: str, user=Depends(auth_manager)):
    file_path = pathlib.Path("datashop", user.username, fname)
    return FileResponse(file_path)


def verify_author(user):
    with Session() as sess:
        auth_row = sess.execute(
            """select * from auth_group where role = 'author'"""
        ).first()
        auth_group_id = auth_row[0]
        is_author = sess.execute(
            f"""select * from auth_membership where user_id = {user.id} and group_id = {auth_group_id}"""
        ).first()
        logger.debug("debugging is author")
        logger.debug(user)
        logger.debug(is_author)
    return is_author


def verify_instructor(user):
    query = text(
        """select * from course_instructor where instructor = :iid and course = :cid"""
    )
    with Session() as sess:
        is_instructor = sess.execute(
            query, params=dict(iid=user.id, cid=user.course_id)
        ).first()

    return is_instructor


def fetch_library_book(book):
    query = library.select().where(library.c.basecourse == book)  # noqa: E712
    with Session() as session:
        res = session.execute(query)
        # the result type of this query is a sqlalchemy CursorResult
        # .all will return a list of Rows
        ret = res.first()
        # the result of .first() is a single sqlalchemy Row object which you can index into positionally
        # or get by attribute or convert to a dictionay with ._asdict()
        return ret


def update_library_book(bookid, vals):
    vals["for_classes"] = "T" if vals["for_classes"] else "F"
    vals["is_visible"] = "T" if vals["is_visible"] else "F"

    stmt = library.update().where(library.c.id == bookid).values(**vals)
    with Session() as session:
        session.execute(stmt)
        session.commit()


# TODO finish this use bookid as title temporarily
def create_library_book(bookid, vals):
    vals["title"] = bookid
    stmt = library.insert().values(**vals)
    with Session() as session:
        session.execute(stmt)
        session.commit()


@app.get("/dump/assignments/{course}")
def dump_assignments(request: Request, course: str, user=Depends(auth_manager)):

    if not (verify_instructor(user) and user.course_name == course):
        return RedirectResponse(url="/notauthorized")

    eng = create_engine(os.environ["DEV_DBURL"])

    all_aq_pairs = pd.read_sql_query(
        f"""
    SELECT assignments.name aname,
           questions.name question,
           assignments.visible,
           assignments.is_peer,
           assignments.is_timed
    FROM assignments
    JOIN assignment_questions ON assignment_questions.assignment_id = assignments.id
    JOIN questions ON questions.id = assignment_questions.question_id
    JOIN courses ON assignments.course = courses.id
    WHERE courses.course_name = '{course}'
    """,
        eng,
    )
    all_aq_pairs.to_csv(f"{course}_assignments.csv", index=False)

    return JSONResponse({"detail": "success"})


@app.get("/impact/{book}")
def impact(request: Request, book: str, user=Depends(auth_manager)):
    # check for author status
    if user:
        if not verify_author(user):
            return RedirectResponse(url="/notauthorized")
    else:
        return RedirectResponse(url="/notauthorized")

    info = fetch_library_book(book)
    resGraph = get_enrollment_graph(book)
    courseGraph = get_course_graph(book)
    chapterHM = get_pv_heatmap(book)

    return templates.TemplateResponse(
        "impact.html",
        context={
            "request": request,
            "enrollData": resGraph,
            "chapterData": chapterHM,
            "courseData": courseGraph,
            "title": info[1],
        },
    )


@app.get("/subchapmap/{chapter}/{book}")
def subchapmap(request: Request, chapter: str, book: str, user=Depends(auth_manager)):
    # check for author status
    if user:
        if not verify_author(user):
            return RedirectResponse(url="/notauthorized")
    else:
        return RedirectResponse(url="/notauthorized")

    info = fetch_library_book(book)
    chapterHM = get_subchap_heatmap(chapter, book)
    return templates.TemplateResponse(
        "subchapmap.html",
        context={"request": request, "subchapData": chapterHM, "title": info[1]},
    )


# Called to download the log
@app.get("/getlog/{book}")
async def getlog(request: Request, book):
    logpath = pathlib.Path("/books", book, "cli.log")

    if logpath.exists():
        async with aiofiles.open(logpath, "rb") as f:
            result = await f.read()
            result = result.decode("utf8")
    else:
        result = "No logfile found"
    return JSONResponse({"detail": result})


@app.get("/editlibrary/{book}")
@app.post("/editlibrary/{book}")
async def editlib(request: Request, book: str):
    # Get the book and populate the form with current data
    book_data = fetch_library_book(book)

    # this will either create the form with data from the submitted form or
    # from the kwargs passed if there is not form data.  So we can prepopulate
    #
    form = await LibraryForm.from_formdata(request, **book_data._asdict())
    if request.method == "POST" and await form.validate():
        print(f"Got {form.authors.data}")
        print(f"FORM data = {form.data}")
        update_library_book(book_data.id, form.data)
        return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
    return templates.TemplateResponse(
        "editlibrary.html", context=dict(request=request, form=form, book=book)
    )


@app.get("/anonymize_data/{book}")
@app.post("/anonymize_data/{book}")
async def anondata(request: Request, book: str, user=Depends(auth_manager)):
    # Get the book and populate the form with current data
    if not verify_author(user):
        return RedirectResponse(url="/notauthorized")

    # Create a list of courses taught by this user to validate courses they
    # can dump directly.
    sel = select([courses, course_instructor]).where(
        and_(
            courses.c.id == course_instructor.c.course,
            course_instructor.c.instructor == user.id,
        )
    )
    class_list = []
    with Session() as sess:
        res = sess.execute(sel)
        for row in res:
            class_list.append(row.course_name)

    lf_path = pathlib.Path("datashop", user.username)
    logger.debug(f"WORKING DIR = {lf_path}")
    if lf_path.exists():
        ready_files = [x for x in lf_path.iterdir()]
    else:
        ready_files = []

    # this will either create the form with data from the submitted form or
    # from the kwargs passed if there is not form data.  So we can prepopulate
    #
    form = await DatashopForm.from_formdata(
        request, basecourse=book, clist=",".join(class_list)
    )
    if request.method == "POST" and await form.validate():
        print(f"Got {form.authors.data}")
        print(f"FORM data = {form.data}")

        # return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
    return templates.TemplateResponse(
        "anonymize_data.html",
        context=dict(
            request=request,
            form=form,
            book=book,
            ready_files=ready_files,
            kind="datashop",
        ),
    )


@app.get("/notauthorized")
def not_authorized(request: Request):
    return templates.TemplateResponse(
        "notauthorized.html", context={"request": request}
    )


@app.post("/book_in_db")
async def check_db(payload=Body(...)):
    base_course = payload["bcname"]
    # connect to db and check if book is there and if base_course == course_name
    if "DEV_DBURL" not in os.environ:
        return JSONResponse({"detail": "DBURL is not set"})
    else:
        sel = select([courses]).where(courses.c.course_name == base_course)
        with Session() as sess:
            res = sess.execute(sel).first()
            detail = res["id"] if res else False
            return JSONResponse({"detail": detail})


@app.post("/add_course")
async def new_course(payload=Body(...), user=Depends(auth_manager)):
    base_course = payload["bcname"]
    github_url = payload["github"]
    if "DEV_DBURL" not in os.environ:
        return JSONResponse({"detail": "DBURL is not set"})
    else:
        res = create_book_entry(user.username, base_course, github_url)
        if res:
            return JSONResponse({"detail": "success"})
        else:
            return JSONResponse({"detail": "fail"})


@app.post("/clone", status_code=201)
async def do_clone(payload=Body(...)):
    repourl = payload["url"]
    bcname = payload["bcname"]
    task = clone_runestone_book.delay(repourl, bcname)
    return JSONResponse({"task_id": task.id})


@app.post("/isCloned", status_code=201)
async def check_repo(payload=Body(...)):
    bcname = payload["bcname"]
    repo_path = pathlib.Path("/books", bcname)
    if repo_path.exists():
        return JSONResponse({"detail": True})
    else:
        return JSONResponse({"detail": False})


@app.post("/buildBook", status_code=201)
async def do_build(payload=Body(...)):
    bcname = payload["bcname"]
    rstproj = pathlib.Path("/books") / bcname / "pavement.py"
    ptxproj = pathlib.Path("/books") / bcname / "project.ptx"
    if ptxproj.exists():
        book_system = "PreTeXt"
    else:
        book_system = "Runestone"
    if book_system == "Runestone":
        task = build_runestone_book.delay(bcname)
    else:
        task = build_ptx_book.delay(bcname)

    return JSONResponse({"task_id": task.id})


@app.post("/deployBook", status_code=201)
async def do_deploy(payload=Body(...)):
    bcname = payload["bcname"]
    task = deploy_book.delay(bcname)
    return JSONResponse({"task_id": task.id})


@app.post("/dumpUseinfo", status_code=201)
async def dump_useinfo(payload=Body(...), user=Depends(auth_manager)):
    classname = payload["classname"]
    task = useinfo_to_csv.delay(classname, user.username)
    return JSONResponse({"task_id": task.id})


@app.post("/dumpCode", status_code=201)
async def dump_useinfo(payload=Body(...), user=Depends(auth_manager)):
    classname = payload["classname"]
    task = code_to_csv.delay(classname, user.username)
    return JSONResponse({"task_id": task.id})


@app.get("/dlsAvailable/{kind}", status_code=201)
async def check_downloads(request: Request, kind: str, user=Depends(auth_manager)):
    # kind will be either logfiles or datashop
    lf_path = pathlib.Path("logfiles", user.username)
    logger.debug(f"WORKING DIR = {lf_path}")
    if lf_path.exists():
        ready_files = [x.name for x in lf_path.iterdir()]
    else:
        ready_files = []

    return JSONResponse({"ready_files": ready_files})


@app.post("/start_extract", status_code=201)
async def do_anonymize(payload=Body(...), user=Depends(auth_manager)):
    payload["user"] = user.username
    task = anonymize_data_dump.delay(**payload)
    return JSONResponse({"task_id": task.id})


# Called from javascript to get the current status of a task
#
@app.get("/tasks/{task_id}")
async def get_status(task_id):
    try:
        task_result = AsyncResult(task_id)
        result = {
            "task_id": task_id,
            "task_status": task_result.status,
            "task_result": task_result.result,
        }
        print("TASK RESULT", task_result.__dict__)
        if task_result.status == "FAILURE":
            result["task_result"] = {"current": str(task_result.result)}
    except:
        result = {
            "task_id": task_id,
            "task_status": "FAILURE",
            "task_result": {"current": "failed"},
        }

    return JSONResponse(result)
