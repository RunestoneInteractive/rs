import pandas as pd

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine

# Local application imports
# -------------------------

from rsptx.db.crud import fetch_course
from rsptx.auth.session import auth_manager, is_instructor
from rsptx.templates import template_folder
from rsptx.configuration import settings

# Routing
# =======
# See `APIRouter config` for an explanation of this approach.
router = APIRouter(
    prefix="/instructor",
    tags=["instructor"],
)


@router.get("/gradebook")
async def get_assignments(
    request: Request, user=Depends(auth_manager), response_class=HTMLResponse
):
    # get the course
    course = await fetch_course(user.course_name)

    if settings.server_config == "development":
        dburl = settings.dev_dburl
    elif settings.server_config == "production":
        dburl = settings.dburl
    eng = create_engine(dburl)

    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return RedirectResponse(url="/")

    classid = course.id

    df = pd.read_sql(
        """
    select score, points, assignments.id as assignment, auth_user.id as sid, is_submit
    from auth_user join grades on (auth_user.id = grades.auth_user)
    join assignments on (grades.assignment = assignments.id)
    where points is not null and assignments.course = %s
    order by last_name, first_name, assignments.duedate, assignments.id
    """,
        eng,
        params=(classid,),
    )

    assignments = pd.read_sql(
        """
    select id, name from assignments where course = %s order by duedate, id
                    """,
        eng,
        params=(classid,),
    )

    students = pd.read_sql(
        """
        select auth_user.id, username, first_name, last_name, email from auth_user join user_courses on auth_user.id = user_id
        join courses on user_courses.course_id = courses.id
        where courses.id = %s order by last_name, first_name
        """,
        eng,
        params=(classid,),
    )

    assignments.index = assignments.id
    aname = assignments.name.to_dict()
    students["full_name"] = students.first_name + " " + students.last_name
    students.index = students.id
    sfirst = students.first_name.to_dict()
    slast = students.last_name.to_dict()
    semail = students.email.to_dict()
    pt = df.pivot(index="sid", columns="assignment", values="score").rename(
        columns=aname
    )

    cols = pt.columns.to_list()
    pt["first_name"] = pt.index.map(sfirst)
    pt["last_name"] = pt.index.map(slast)
    pt["email"] = pt.index.map(semail)
    pt = pt.sort_values(by=["last_name", "first_name"])
    pt = pt[["first_name", "last_name", "email"] + cols]
    pt = pt.reset_index()
    pt = pt.drop(columns=["sid"], axis=1)
    pt.columns.name = None

    templates = Jinja2Templates(directory=template_folder)

    return templates.TemplateResponse(
        "assignment/instructor/gradebook.html",
        {
            "table_html": pt.to_html(
                table_id="table",
                columns=["first_name", "last_name", "email"] + cols,
                index=False,
                na_rep="",
            ),
            "course": course,
            "user": user.username,
            "request": request,
            "is_instructor": user_is_instructor,
            "student_page": False,
        },
    )
