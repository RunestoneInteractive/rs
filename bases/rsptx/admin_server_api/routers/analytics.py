"""
analytics.py - Chapter Summary Report endpoints for the admin server.

Ports the subchapoverview endpoint from the old web2py dashboard.py.
Reports are generated as background tasks; results are stored in Redis
so any server in the cluster can serve the polling responses.
"""

import json
import uuid
from typing import Optional

import pandas as pd
import redis as redis_lib
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Cookie,
    Depends,
    HTTPException,
    Request,
    status,
)
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine

from rsptx.auth.session import auth_manager
from rsptx.configuration import settings
from rsptx.endpoint_validators import instructor_role_required, with_course
from rsptx.logging import rslogger
from rsptx.templates import template_folder

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
)

templates = Jinja2Templates(directory=template_folder)

# ---------------------------------------------------------------------------
# Redis helpers
# ---------------------------------------------------------------------------

TASK_TTL_SECONDS = 1800  # 30 minutes


def _get_redis() -> redis_lib.Redis:
    return redis_lib.from_url(settings.redis_uri, decode_responses=True)


def _task_key(task_id: str) -> str:
    return f"subchapoverview:{task_id}"


def _set_task(r: redis_lib.Redis, task_id: str, payload: dict) -> None:
    r.set(_task_key(task_id), json.dumps(payload), ex=TASK_TTL_SECONDS)


def _get_task(r: redis_lib.Redis, task_id: str) -> Optional[dict]:
    raw = r.get(_task_key(task_id))
    if raw is None:
        return None
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Background report generation
# ---------------------------------------------------------------------------

ANSWER_TABLES = [
    "mchoice_answers",
    "fitb_answers",
    "parsons_answers",
    "codelens_answers",
    "clickablearea_answers",
    "splice_answers",
    "dragndrop_answers",
    "unittest_answers",
]


def _build_report(
    task_id: str,
    course_name: str,
    base_course: str,
    chapter: str,
    tablekind: str,
    tz_offset_hours: float,
) -> None:
    """Run in a BackgroundTask. Writes result JSON to Redis."""
    r = _get_redis()
    try:
        engine = create_engine(settings.dburl)

        if tablekind == "correctcount":
            data = _make_correct_count(engine, course_name, base_course, chapter)
        else:
            data = _make_activity_table(
                engine, course_name, base_course, chapter, tablekind, tz_offset_hours
            )

        _set_task(r, task_id, {"status": "complete", "data": data})
    except Exception as exc:
        rslogger.exception(f"subchapoverview background task {task_id} failed: {exc}")
        _set_task(r, task_id, {"status": "error", "message": str(exc)})


def _chapter_clause_for_useinfo(chapter: str) -> str:
    if chapter == "all":
        return ""
    return f"and chapter = '{chapter}'"


def _chapter_clause_for_chapters(chapter: str, chap_labs: list) -> str:
    if chapter == "all":
        return ""
    return f"and chapters.chapter_label = '{chapter}'"


def _make_activity_table(
    engine,
    course_name: str,
    base_course: str,
    chapter: str,
    tablekind: str,
    tz_offset_hours: float,
) -> list:
    """Builds sccount / dividmin / dividmax pivot tables."""
    ch_clause = _chapter_clause_for_useinfo(chapter)

    data = pd.read_sql_query(
        f"""
        select sid, first_name, last_name, useinfo.timestamp, div_id, chapter, subchapter
        from useinfo
        join questions on div_id = name and base_course = %(base_course)s {ch_clause}
        join auth_user on username = useinfo.sid
        where useinfo.course_id = %(course_name)s and active = 'T'
        """,
        engine,
        params={"base_course": base_course, "course_name": course_name},
        parse_dates=["timestamp"],
    )

    # Remove LTI anonymous users (38+ digit @ usernames)
    data = data[~data.sid.str.contains(r"^\d{38,}@", regex=True)]

    # Apply timezone offset
    tdoff = pd.Timedelta(hours=tz_offset_hours)
    data["timestamp"] = data["timestamp"].map(lambda x: x - tdoff)

    # Build student label.
    # TODO: once a student detail drilldown page exists in the new system, replace
    # the plain text label below with an HTML link, e.g.:
    #   f'<a href="/analytics/student_detail?sid={sid}&course={course_name}">{label}</a>'
    data["sid"] = (
        data["last_name"] + ", " + data["first_name"] + " (" + data["sid"] + ")"
    )

    if tablekind == "sccount":
        values = "div_id"
        afunc = "nunique"
        idxlist = ["chapter", "subchapter"]
    elif tablekind == "dividmin":
        values = "timestamp"
        afunc = "min"
        idxlist = ["chapter", "subchapter", "div_id"]
    elif tablekind == "dividmax":
        values = "timestamp"
        afunc = "max"
        idxlist = ["chapter", "subchapter", "div_id"]
    else:
        values = "timestamp"
        afunc = "count"
        idxlist = ["chapter", "subchapter", "div_id"]

    if data.empty:
        rslogger.warning(f"Empty dataframe for subchapoverview {course_name}/{chapter}")
        return []

    pt = data.pivot_table(index=idxlist, values=values, columns="sid", aggfunc=afunc)

    if pt.empty:
        return []

    # Pull chapter/subchapter ordering info
    if chapter == "all":
        ch_join_clause = ""
    else:
        ch_join_clause = f"and chapters.chapter_label = '{chapter}'"

    cmap = pd.read_sql_query(
        f"""
        select chapter_num, sub_chapter_num, chapter_label, sub_chapter_label
        from sub_chapters
        join chapters on chapters.id = sub_chapters.chapter_id
        where chapters.course_id = %(base_course)s {ch_join_clause}
        order by chapter_num, sub_chapter_num
        """,
        engine,
        params={"base_course": base_course},
    )

    act_count = pd.read_sql_query(
        """
        select chapter, subchapter, count(*) as act_count
        from questions
        where base_course = %(base_course)s and from_source = 'T'
        group by chapter, subchapter
        """,
        engine,
        params={"base_course": base_course},
    )

    if tablekind != "sccount":
        pt = pt.reset_index(2)

    mtbl = pt.merge(
        cmap,
        left_index=True,
        right_on=["chapter_label", "sub_chapter_label"],
        how="outer",
    )
    mtbl = mtbl.set_index(["chapter_num", "sub_chapter_num"]).sort_index().reset_index()

    mtbl = mtbl.merge(
        act_count,
        left_on=["chapter_label", "sub_chapter_label"],
        right_on=["chapter", "subchapter"],
        how="left",
    )

    def _to_int(x):
        try:
            return int(x)
        except (ValueError, TypeError):
            return ""

    if tablekind == "sccount":
        mtbl["chapter_label"] = mtbl.apply(
            lambda row: "{}.{} {}/{} ({})".format(
                _to_int(row.chapter_num),
                _to_int(row.sub_chapter_num),
                row.chapter_label,
                row.sub_chapter_label,
                int(row.act_count - 1) if pd.notna(row.get("act_count")) else "?",
            ),
            axis=1,
        )
    else:
        mtbl["chapter_label"] = mtbl.apply(
            lambda row: "{}.{} {}/{}".format(
                _to_int(row.chapter_num),
                _to_int(row.sub_chapter_num),
                row.chapter_label,
                row.sub_chapter_label,
            ),
            axis=1,
        )

    # Keep chapter_label + student columns only
    neworder = mtbl.columns.to_list()
    neworder = neworder[-5:-4] + neworder[2:-5]
    mtbl = mtbl[neworder]

    return json.loads(mtbl.to_json(orient="records", date_format="iso"))


def _make_correct_count(
    engine,
    course_name: str,
    base_course: str,
    chapter: str,
) -> list:
    """Builds the correctcount pivot table from all answer tables."""
    union_parts = "\n    union\n    ".join(
        f"(select div_id, sid, correct, percent from {tbl} where course_name = %(course_name)s)"
        for tbl in ANSWER_TABLES
    )
    df = pd.read_sql_query(
        f"""
        select div_id, sid, correct, percent, chapter, subchapter
        from (
            {union_parts}
        ) as T
        join questions on div_id = name and base_course = %(base_course)s
        """,
        engine,
        params={"course_name": course_name, "base_course": base_course},
    )

    if chapter == "all":
        correct = df[df.correct == "T"]
    else:
        correct = df[(df.correct == "T") & (df.chapter == chapter)]

    correct = correct.drop_duplicates()

    if correct.empty:
        return []

    mtbl = correct.pivot_table(
        index="subchapter",
        columns="sid",
        values="correct",
        aggfunc="count",
        fill_value=0,
    )
    mtbl = mtbl.reset_index().rename(columns={"subchapter": "chapter_label"})
    mtbl.sort_values("chapter_label", inplace=True)

    # Ensure all enrolled students appear (even those with 0 correct)
    enrolled = pd.read_sql_query(
        """
        select distinct username
        from auth_user
        join user_courses on auth_user.course_id = user_courses.course_id
        where user_courses.course_id = (
            select id from courses where course_name = %(course_name)s
        )
        """,
        engine,
        params={"course_name": course_name},
    )
    for username in enrolled["username"].tolist():
        if username not in mtbl.columns:
            mtbl[username] = 0

    student_cols = sorted(mtbl.columns[1:], key=lambda x: x.lower())
    mtbl = mtbl[["chapter_label"] + student_cols]

    return json.loads(mtbl.to_json(orient="records", date_format="iso"))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/subchapoverview", response_class=HTMLResponse)
@instructor_role_required()
@with_course()
async def get_subchapoverview(
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """Serve the chapter overview report shell page."""
    engine = create_engine(settings.dburl)
    chapters_df = pd.read_sql_query(
        """
        select chapter_name, chapter_label
        from chapters
        where course_id = %(base_course)s
        order by chapter_num
        """,
        engine,
        params={"base_course": course.base_course},
    )
    chapters = chapters_df.to_dict(orient="records")

    context = {
        "request": request,
        "user": user,
        "course": course,
        "chapters": chapters,
        "is_instructor": True,
        "student_page": False,
        "settings": settings,
    }
    return templates.TemplateResponse("admin/analytics/subchapoverview.html", context)


@router.post("/subchapoverview/generate")
@instructor_role_required()
@with_course()
async def generate_subchapoverview(
    request: Request,
    background_tasks: BackgroundTasks,
    user=Depends(auth_manager),
    course=None,
    RS_info: Optional[str] = Cookie(None),
):
    """
    Accept report parameters, store a 'pending' marker in Redis, and kick off
    the background report generation. Returns a task_id for polling.

    Timezone offset is read from the RS_info cookie (field: tz_offset).
    """
    body = await request.json()
    chapter = body.get("chapter", "")
    tablekind = body.get("tablekind", "sccount")

    # Read timezone offset from the RS_info cookie (set by the book server)
    tz_offset_hours = 0.0
    if RS_info:
        try:
            parsed_rs = json.loads(RS_info)
            tz_offset_hours = float(parsed_rs.get("tz_offset", 0))
        except Exception:
            rslogger.warning("Could not parse RS_info cookie for tz_offset")

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="chapter is required",
        )

    task_id = str(uuid.uuid4())
    r = _get_redis()
    _set_task(r, task_id, {"status": "pending"})

    background_tasks.add_task(
        _build_report,
        task_id=task_id,
        course_name=course.course_name,
        base_course=course.base_course,
        chapter=chapter,
        tablekind=tablekind,
        tz_offset_hours=tz_offset_hours,
    )

    rslogger.info(
        f"Queued subchapoverview task {task_id} for {course.course_name} "
        f"chapter={chapter} tablekind={tablekind}"
    )
    return JSONResponse({"task_id": task_id, "status": "pending"})


@router.get("/subchapoverview/result/{task_id}")
@instructor_role_required()
async def get_subchapoverview_result(
    task_id: str,
    request: Request,
    user=Depends(auth_manager),
):
    """Poll Redis for the status/result of a previously submitted report task."""
    r = _get_redis()
    payload = _get_task(r, task_id)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or expired",
        )
    return JSONResponse(payload)


@router.get("/subchapoverview/csv/{task_id}")
@instructor_role_required()
@with_course()
async def download_subchapoverview_csv(
    task_id: str,
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """Stream the cached report as a CSV download."""
    r = _get_redis()
    payload = _get_task(r, task_id)
    if payload is None or payload.get("status") != "complete":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found, not yet complete, or expired",
        )

    df = pd.DataFrame(payload["data"])
    csv_content = df.to_csv(index=False, na_rep=" ")

    filename = f"data_for_{course.course_name}.csv"
    return StreamingResponse(
        iter([csv_content]),
        media_type="application/vnd.ms-excel",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
