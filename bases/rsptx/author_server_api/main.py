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
import logging
import sys
import time

# third party
# -----------
import aiofiles
from rsptx.db.crud import (
    create_instructor_course_entry,
    fetch_base_course,
    fetch_user,
)
from fastapi import Body, FastAPI, Request, Depends, status
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from celery.result import AsyncResult
import pandas as pd
from sqlalchemy import create_engine

# Local App
# ---------
from rsptx.forms import LibraryForm, DatashopForm, DatashopInstForm
from rsptx.author_server_api.worker import (
    build_runestone_book,
    clone_runestone_book,
    build_ptx_book,
    deploy_book,
    useinfo_to_csv,
    code_to_csv,
    anonymize_data_dump,
)
from rsptx.auth.session import is_instructor
from rsptx.db.crud import (
    create_book_author,
    create_library_book,
    fetch_instructor_courses,
    fetch_books_by_author,
    fetch_course,
    fetch_course_by_id,
    fetch_library_book,
    update_library_book,
    create_course,
    CoursesValidator,
)


from rsptx.visualization.authorImpact import (
    get_enrollment_graph,
    get_pv_heatmap,
    get_subchap_heatmap,
    get_course_graph,
)
from rsptx.auth.session import auth_manager
from rsptx.db.async_session import async_session
from rsptx.templates import template_folder

logger = logging.getLogger("runestone")
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter("%(levelname)s: %(asctime)s:  %(funcName)s: %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

app = FastAPI()
# The static and templates folders are siblings with this file.
# We need to create a path that will work inside and outside of docker.
base_dir = pathlib.Path(template_folder)
app.mount("/static", StaticFiles(directory=base_dir / "staticAssets"), name="static")
templates = Jinja2Templates(directory=template_folder)


async def create_book_entry(author: str, document_id: str, github: str):
    # need to create a library entry first.

    course = CoursesValidator(
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
    await create_course(course)

    vals = {
        "authors": author,
        "title": document_id,
        "github_url": github,
        "shelf_section": "Misc",
        "is_visible": False,
        "for_classes": False,
    }
    await create_library_book(document_id, vals)
    await create_book_author(author, document_id)
    c_from_db = await fetch_base_course(document_id)
    u_from_db = await fetch_user(author)
    await create_instructor_course_entry(u_from_db.id, c_from_db.id)

    return True


# Install the auth_manager as middleware This will make the user
# part of the request ``request.state.user`` `See FastAPI_Login Advanced <https://fastapi-login.readthedocs.io/advanced_usage/>`_
auth_manager.useRequest(app)


@app.get("/author/")
async def home(request: Request, user=Depends(auth_manager)):
    print(f"{request.state.user} OR user = {user}")

    course = await fetch_course(user.course_name)
    if user:
        if not await verify_author(user):
            return RedirectResponse(url="/notauthorized")

    if user:
        name = user.first_name
        book_list = await fetch_books_by_author(user.username)
    else:
        name = "unknown person"
        book_list = []
        # redirect them back somewhere....

    return templates.TemplateResponse(
        "author/home.html",
        context={
            "request": request,
            "name": name,
            "book_list": book_list,
            "course": course,
        },
    )


@app.get("/author/logfiles")
async def logfiles(request: Request, user=Depends(auth_manager)):
    if await is_instructor(request):
        lf_path = pathlib.Path("downloads", "logfiles", user.username)
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
        course = await fetch_course(user.course_name)
        logger.debug(f"{ready_files=}")
        return templates.TemplateResponse(
            "author/logfiles.html",
            context=dict(
                request=request,
                ready_files=ready_files,
                course=course,
                username=user.username,
            ),
        )
    else:
        return RedirectResponse(url="/notauthorized")


@app.get("/author/getfile/{fname}")
async def getfile(request: Request, fname: str, user=Depends(auth_manager)):
    file_path = pathlib.Path("downloads", "logfiles", user.username, fname)
    return FileResponse(file_path)


@app.get("/author/getdatashop/{fname}")
async def _getdshop(request: Request, fname: str, user=Depends(auth_manager)):
    file_path = pathlib.Path("downloads", "datashop", user.username, fname)
    return FileResponse(file_path)


async def verify_author(user):
    async with async_session() as sess:
        auth_row = await sess.execute(
            """select * from auth_group where role = 'author'"""
        )
        logger.debug(f"HELLO{str(auth_row)}")
        auth_group_id = auth_row.scalars().first()
        logger.debug(f"FOO {str(auth_group_id)}")
        is_author = (
            (
                await sess.execute(
                    f"""select * from auth_membership where user_id = {user.id} and group_id = {auth_group_id}"""
                )
            )
            .scalars()
            .first()
        )

        logger.debug("debugging is author")
        logger.debug(user)
        logger.debug(is_author)
    return is_author


@app.get("/author/dump/assignments/{course}")
async def dump_assignments(request: Request, course: str, user=Depends(auth_manager)):
    if not (await is_instructor(request) and user.course_name == course):
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
    all_aq_pairs.to_csv(
        f"downloads/logfiles/{user.username}/{course}_assignments.csv", index=False
    )

    return JSONResponse({"detail": "success"})


@app.get("/author/impact/{book}")
async def impact(request: Request, book: str, user=Depends(auth_manager)):
    # check for author status
    if user:
        if not await verify_author(user):
            return RedirectResponse(url="/notauthorized")
    else:
        return RedirectResponse(url="/notauthorized")

    course = await fetch_course(user.course_name)
    info = await fetch_library_book(book)
    resGraph = get_enrollment_graph(book)
    courseGraph = get_course_graph(book)
    chapterHM = get_pv_heatmap(book)

    return templates.TemplateResponse(
        "author/impact.html",
        context={
            "request": request,
            "enrollData": resGraph,
            "chapterData": chapterHM,
            "courseData": courseGraph,
            "title": info.title,
            "course": course,
        },
    )


@app.get("/author/subchapmap/{chapter}/{book}")
async def subchapmap(
    request: Request, chapter: str, book: str, user=Depends(auth_manager)
):
    # check for author status
    if user:
        if not await verify_author(user):
            return RedirectResponse(url="/notauthorized")
    else:
        return RedirectResponse(url="/notauthorized")

    info = await fetch_library_book(book)
    chapterHM = get_subchap_heatmap(chapter, book)
    return templates.TemplateResponse(
        "author/subchapmap.html",
        context={"request": request, "subchapData": chapterHM, "title": info.title},
    )


# Called to download the log
@app.get("/author/getlog/{book}")
async def getlog(request: Request, book):
    logpath = pathlib.Path("/books", book, "cli.log")

    if logpath.exists():
        async with aiofiles.open(logpath, "rb") as f:
            result = await f.read()
            result = result.decode("utf8")
    else:
        result = "No logfile found"
    return JSONResponse({"detail": result})


def get_model_dict(model):
    return dict(
        (column.name, getattr(model, column.name)) for column in model.__table__.columns
    )


@app.get("/author/editlibrary/{book}")
@app.post("/author/editlibrary/{book}")
async def editlib(request: Request, book: str, user=Depends(auth_manager)):
    # Get the book and populate the form with current data
    book_data = await fetch_library_book(book)
    course = await fetch_course(user.course_name)

    # this will either create the form with data from the submitted form or
    # from the kwargs passed if there is not form data.  So we can prepopulate
    #
    book_data_dict = get_model_dict(book_data)
    form = await LibraryForm.from_formdata(request, **book_data_dict)
    if request.method == "POST" and await form.validate():
        print(f"Got {form.authors.data}")
        print(f"FORM data = {form.data}")
        await update_library_book(book_data.id, form.data)
        return RedirectResponse(url="/author/", status_code=status.HTTP_303_SEE_OTHER)
    return templates.TemplateResponse(
        "author/editlibrary.html",
        context=dict(request=request, form=form, book=book, course=course),
    )


@app.get("/author/anonymize_data/{book}")
@app.post("/author/anonymize_data/{book}")
async def anondata(request: Request, book: str, user=Depends(auth_manager)):
    # Get the book and populate the form with current data
    is_author = await verify_author(user)
    is_inst = await is_instructor(request)

    if not (is_author or is_inst):
        return RedirectResponse(url="/author/notauthorized")

    # Create a list of courses taught by this user to validate courses they
    # can dump directly.
    course = await fetch_course(user.course_name)
    courses = await fetch_instructor_courses(user.id)
    class_list = []
    for c in courses:
        the_course = await fetch_course_by_id(c.course)
        class_list.append(the_course.course_name)

    lf_path = pathlib.Path("downloads", "datashop", user.username)
    logger.debug(f"WORKING DIR = {lf_path}")
    if lf_path.exists():
        ready_files = [x for x in lf_path.iterdir()]
    else:
        ready_files = []

    # this will either create the form with data from the submitted form or
    # from the kwargs passed if there is not form data.  So we can prepopulate
    #
    if is_author:
        form = await DatashopForm.from_formdata(
            request, basecourse=book, clist=",".join(class_list)
        )

    elif is_inst:
        form = await DatashopInstForm.from_formdata(
            request,
            basecourse=book,
            clist=",".join(class_list),
            specific_course=course.course_name,
        )
        form.specific_course.choices = class_list
    if request.method == "POST" and await form.validate():
        print(f"Got {form.authors.data}")
        print(f"FORM data = {form.data}")
        # return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
    return templates.TemplateResponse(
        "author/anonymize_data.html",
        context=dict(
            request=request,
            form=form,
            book=book,
            ready_files=ready_files,
            kind="datashop",
            course=course,
            is_author=is_author,
            is_instructor=is_inst,
        ),
    )


@app.get("/author/notauthorized")
def not_authorized(request: Request):
    return templates.TemplateResponse(
        "author/notauthorized.html", context={"request": request}
    )


@app.post("/author/book_in_db")
async def check_db(payload=Body(...)):
    base_course = payload["bcname"]
    # connect to db and check if book is there and if base_course == course_name
    if "DEV_DBURL" not in os.environ:
        return JSONResponse({"detail": "DBURL is not set"})
    else:
        res = await fetch_course(base_course)
        detail = res.id if res else False
        return JSONResponse({"detail": detail})


@app.post("/author/add_course")
async def new_course(payload=Body(...), user=Depends(auth_manager)):
    base_course = payload["bcname"]
    github_url = payload["github"]
    logger.debug(f"Got {base_course} and {github_url}")

    if "DEV_DBURL" not in os.environ:
        return JSONResponse({"detail": "DBURL is not set"})
    else:
        res = await create_book_entry(user.username, base_course, github_url)
        if res:
            return JSONResponse({"detail": "success"})
        else:
            return JSONResponse({"detail": "fail"})


@app.post("/author/clone", status_code=201)
async def do_clone(payload=Body(...)):
    repourl = payload["url"]
    bcname = payload["bcname"]
    task = clone_runestone_book.delay(repourl, bcname)
    return JSONResponse({"task_id": task.id})


@app.post("/author/isCloned", status_code=201)
async def check_repo(payload=Body(...)):
    bcname = payload["bcname"]
    repo_path = pathlib.Path("/books", bcname)
    if repo_path.exists():
        return JSONResponse({"detail": True})
    else:
        return JSONResponse({"detail": False})


@app.post("/author/buildBook", status_code=201)
async def do_build(payload=Body(...)):
    bcname = payload["bcname"]
    generate = payload["generate"]
    ptxproj = pathlib.Path("/books") / bcname / "project.ptx"
    if ptxproj.exists():
        book_system = "PreTeXt"
    else:
        book_system = "Runestone"
    if book_system == "Runestone":
        task = build_runestone_book.delay(bcname)
    else:
        task = build_ptx_book.delay(bcname, generate)

    return JSONResponse({"task_id": task.id})


@app.post("/author/deployBook", status_code=201)
async def do_deploy(payload=Body(...)):
    bcname = payload["bcname"]
    task = deploy_book.delay(bcname)
    return JSONResponse({"task_id": task.id})


@app.post("/author/dumpUseinfo", status_code=201)
async def dump_useinfo(payload=Body(...), user=Depends(auth_manager)):
    classname = payload["classname"]
    task = useinfo_to_csv.delay(classname, user.username)
    return JSONResponse({"task_id": task.id})


@app.post("/author/dumpCode", status_code=201)
async def dump_code(payload=Body(...), user=Depends(auth_manager)):
    classname = payload["classname"]
    task = code_to_csv.delay(classname, user.username)
    return JSONResponse({"task_id": task.id})


@app.get("/author/dlsAvailable/{kind}", status_code=201)
async def check_downloads(request: Request, kind: str, user=Depends(auth_manager)):
    # kind will be either logfiles or datashop
    lf_path = pathlib.Path("downloads", "logfiles", user.username)
    logger.debug(f"WORKING DIR = {lf_path}")
    if lf_path.exists():
        ready_files = [x.name for x in lf_path.iterdir()]
    else:
        ready_files = []

    return JSONResponse({"ready_files": ready_files})


@app.post("/author/start_extract", status_code=201)
async def do_anonymize(payload=Body(...), user=Depends(auth_manager)):
    payload["user"] = user.username
    task = anonymize_data_dump.delay(**payload)
    return JSONResponse({"task_id": task.id})


# Called from javascript to get the current status of a task
#
@app.get("/author/tasks/{task_id}")
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
