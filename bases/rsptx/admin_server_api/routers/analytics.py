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

# Subset that have a boolean `correct` column (used by student drilldown)
CORRECT_ANSWER_TABLES = [
    "mchoice_answers",
    "fitb_answers",
    "parsons_answers",
    "codelens_answers",
    "clickablearea_answers",
    "splice_answers",
    "dragndrop_answers",
    "unittest_answers",
    "matching_answers",
    "microparsons_answers",
    "webwork_answers",
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

    # Build student label — "Last, First (username)".
    # subchapoverview.js extracts the username from the trailing parens to
    # build a link to the student_detail drilldown page.
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
# Student drilldown helpers
# ---------------------------------------------------------------------------


def _build_student_detail(
    engine,
    course_name: str,
    base_course: str,
    sid: str,
    tz_offset_hours: float,
) -> dict:
    """
    Returns two lists of records for the student detail page:
      - ``subchapter_summary``: one row per subchapter with visit/attempt counts
      - ``exercise_detail``:    one row per exercise with click counts and answer status
    """
    tdoff = pd.Timedelta(hours=tz_offset_hours)

    # ------------------------------------------------------------------
    # 1. Activity from useinfo (every click this student made)
    # ------------------------------------------------------------------
    # Use a DISTINCT subquery on questions so that if a div_id appears more
    # than once in the questions table (duplicate rows or multi-chapter entries)
    # we still get exactly one (chapter, subchapter) per div_id.  Without this,
    # the plain JOIN fans out and inflates count(*) / sum() values.
    activity = pd.read_sql_query(
        """
        select useinfo.div_id, q.chapter, q.subchapter,
               count(*) as clicks,
               min(useinfo.timestamp) as first_visit,
               max(useinfo.timestamp) as last_visit
        from useinfo
        join (
            select distinct name, chapter, subchapter
            from questions
            where base_course = %(base_course)s
        ) q on useinfo.div_id = q.name
        where useinfo.course_id = %(course_name)s and useinfo.sid = %(sid)s
        group by useinfo.div_id, q.chapter, q.subchapter
        order by q.chapter, q.subchapter, useinfo.div_id
        """,
        engine,
        params={"base_course": base_course, "course_name": course_name, "sid": sid},
        parse_dates=["first_visit", "last_visit"],
    )

    # Apply timezone offset
    if not activity.empty:
        activity["first_visit"] = activity["first_visit"].map(lambda x: x - tdoff)
        activity["last_visit"] = activity["last_visit"].map(lambda x: x - tdoff)

    # ------------------------------------------------------------------
    # 2. Answers from all graded answer tables
    # ------------------------------------------------------------------
    union_parts = "\n    union all\n    ".join(
        f"(select div_id, correct, percent, timestamp"
        f" from {tbl}"
        f" where course_name = %(course_name)s and sid = %(sid)s)"
        for tbl in CORRECT_ANSWER_TABLES
    )
    answers = pd.read_sql_query(
        f"select div_id, correct, percent, timestamp from ({union_parts}) as t",
        engine,
        params={"course_name": course_name, "sid": sid},
        parse_dates=["timestamp"],
    )

    if not answers.empty:
        ans_agg = (
            answers.groupby("div_id")
            .agg(
                attempts=("correct", "count"),
                correct_count=("correct", lambda x: (x == "T").sum()),
                last_answer=(
                    "timestamp",
                    lambda x: (
                        (x.max() - tdoff).isoformat() if pd.notna(x.max()) else None
                    ),
                ),
            )
            .reset_index()
        )
        ans_agg["ever_correct"] = ans_agg["correct_count"] > 0
    else:
        ans_agg = pd.DataFrame(
            columns=[
                "div_id",
                "attempts",
                "correct_count",
                "ever_correct",
                "last_answer",
            ]
        )

    # ------------------------------------------------------------------
    # 3. Total activities available per subchapter (from questions table)
    # ------------------------------------------------------------------
    act_count = pd.read_sql_query(
        """
        select chapter, subchapter, count(*) as total_activities
        from questions
        where base_course = %(base_course)s and from_source = 'T'
        group by chapter, subchapter
        """,
        engine,
        params={"base_course": base_course},
    )

    # ------------------------------------------------------------------
    # 4. Build exercise detail rows (one per div_id)
    # ------------------------------------------------------------------
    if activity.empty:
        exercise_detail = []
    else:
        detail = activity.merge(ans_agg, on="div_id", how="left")
        detail["first_visit"] = detail["first_visit"].dt.strftime("%Y-%m-%d %H:%M")
        detail["last_visit"] = detail["last_visit"].dt.strftime("%Y-%m-%d %H:%M")

        # Human-readable correct column
        def _correct_label(row):
            if pd.isna(row.get("attempts")) or row["attempts"] == 0:
                return ""
            return "Yes" if row["ever_correct"] else "No"

        detail["correct"] = detail.apply(_correct_label, axis=1)
        detail["attempts"] = detail["attempts"].fillna(0).astype(int)
        detail = detail.rename(
            columns={
                "div_id": "Exercise",
                "chapter": "Chapter",
                "subchapter": "Subchapter",
                "clicks": "Clicks",
                "attempts": "Attempts",
                "correct": "Correct",
                "first_visit": "First Visit",
                "last_visit": "Last Visit",
            }
        )
        cols = [
            "Chapter",
            "Subchapter",
            "Exercise",
            "Clicks",
            "Attempts",
            "Correct",
            "First Visit",
            "Last Visit",
        ]
        exercise_detail = json.loads(detail[cols].to_json(orient="records"))

    # ------------------------------------------------------------------
    # 5. Build subchapter summary (one per chapter/subchapter)
    # ------------------------------------------------------------------
    if activity.empty:
        subchapter_summary = []
    else:
        sc = (
            activity.groupby(["chapter", "subchapter"])
            .agg(
                exercises_visited=("div_id", "nunique"),
                total_clicks=("clicks", "sum"),
                first_visit=("first_visit", "min"),
                last_visit=("last_visit", "max"),
            )
            .reset_index()
        )

        # Add answer stats per subchapter
        if not ans_agg.empty:
            ans_with_sc = ans_agg.merge(
                activity[["div_id", "chapter", "subchapter"]].drop_duplicates(),
                on="div_id",
                how="left",
            )
            sc_ans = (
                ans_with_sc.groupby(["chapter", "subchapter"])
                .agg(
                    attempted=("attempts", "sum"),
                    correct_sum=("correct_count", "sum"),
                )
                .reset_index()
            )
            sc = sc.merge(sc_ans, on=["chapter", "subchapter"], how="left")
        else:
            sc["attempted"] = 0
            sc["correct_sum"] = 0

        sc = sc.merge(act_count, on=["chapter", "subchapter"], how="left")
        sc["attempted"] = sc["attempted"].fillna(0).astype(int)
        sc["correct_sum"] = sc["correct_sum"].fillna(0).astype(int)
        sc["total_activities"] = sc["total_activities"].fillna(0).astype(int)
        sc["first_visit"] = sc["first_visit"].dt.strftime("%Y-%m-%d %H:%M")
        sc["last_visit"] = sc["last_visit"].dt.strftime("%Y-%m-%d %H:%M")

        sc = sc.rename(
            columns={
                "chapter": "Chapter",
                "subchapter": "Subchapter",
                "exercises_visited": "Visited",
                "total_activities": "Available",
                "total_clicks": "Total Clicks",
                "attempted": "Answered",
                "correct_sum": "Correct",
                "first_visit": "First Visit",
                "last_visit": "Last Visit",
            }
        )
        sc_cols = [
            "Chapter",
            "Subchapter",
            "Visited",
            "Available",
            "Total Clicks",
            "Answered",
            "Correct",
            "First Visit",
            "Last Visit",
        ]
        subchapter_summary = json.loads(sc[sc_cols].to_json(orient="records"))

    return {
        "subchapter_summary": subchapter_summary,
        "exercise_detail": exercise_detail,
    }


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


# ---------------------------------------------------------------------------
# Assignment Overview — Redis helpers
# ---------------------------------------------------------------------------


def _ao_task_key(task_id: str) -> str:
    return f"assignmentoverview:{task_id}"


def _set_ao_task(r: redis_lib.Redis, task_id: str, payload: dict) -> None:
    r.set(_ao_task_key(task_id), json.dumps(payload), ex=TASK_TTL_SECONDS)


def _get_ao_task(r: redis_lib.Redis, task_id: str) -> Optional[dict]:
    raw = r.get(_ao_task_key(task_id))
    if raw is None:
        return None
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Assignment Overview — background report generation
# ---------------------------------------------------------------------------


def _build_assignment_report(
    task_id: str,
    assignment_id: int,
    course_name: str,
    tz_offset_hours: float,
) -> None:
    """Run in a BackgroundTask. Builds per-question stats for an assignment."""
    r = _get_redis()
    try:
        engine = create_engine(settings.dburl)
        data = _make_assignment_table(
            engine, assignment_id, course_name, tz_offset_hours
        )
        _set_ao_task(
            r,
            task_id,
            {"status": "complete", "data": data, "assignment_id": assignment_id},
        )
    except Exception as exc:
        rslogger.exception(
            f"assignmentoverview background task {task_id} failed: {exc}"
        )
        _set_ao_task(r, task_id, {"status": "error", "message": str(exc)})


def _make_assignment_table(
    engine,
    assignment_id: int,
    course_name: str,
    tz_offset_hours: float,
) -> list:
    """
    Build the assignment overview pivot table.

    Rows = questions in the assignment (sorted by sorting_priority).
    Fixed stat columns: Question, Type, Points, Interactions, First, Last,
                        # Correct, # Incorrect, # Never Tried, Avg Score.
    Per-student columns: their score from question_grades (or blank if none).
    """
    tdoff = pd.Timedelta(hours=tz_offset_hours)

    # 1. Questions in this assignment
    questions = pd.read_sql_query(
        """
        SELECT q.name AS div_id, q.question_type,
               aq.points, aq.sorting_priority
        FROM assignment_questions aq
        JOIN questions q ON q.id = aq.question_id
        WHERE aq.assignment_id = %(assignment_id)s
        ORDER BY aq.sorting_priority
        """,
        engine,
        params={"assignment_id": assignment_id},
    )
    if questions.empty:
        return []

    div_ids = tuple(questions["div_id"].tolist())

    # 2. Enrolled students (non-LTI, non-instructor)
    enrolled = pd.read_sql_query(
        """
        SELECT DISTINCT u.username, u.first_name, u.last_name
        FROM user_courses uc
        JOIN auth_user u ON u.id = uc.user_id
        WHERE uc.course_id = (
            SELECT id FROM courses WHERE course_name = %(course_name)s
        )
          AND u.id NOT IN (
            SELECT instructor FROM course_instructor
            WHERE course = (
                SELECT id FROM courses WHERE course_name = %(course_name)s
            )
          )
        ORDER BY u.last_name, u.first_name, u.username
        """,
        engine,
        params={"course_name": course_name},
    )
    enrolled = enrolled[
        ~enrolled["username"].str.contains(r"^\d{38,}@", regex=True, na=False)
    ]
    n_enrolled = len(enrolled)

    # 3. Interaction data from useinfo
    interactions = pd.read_sql_query(
        """
        SELECT sid, div_id,
               COUNT(*) AS interactions,
               MIN(timestamp) AS first_interaction,
               MAX(timestamp) AS last_interaction
        FROM useinfo
        WHERE course_id = %(course_name)s
          AND div_id IN %(div_ids)s
        GROUP BY sid, div_id
        """,
        engine,
        params={"course_name": course_name, "div_ids": div_ids},
        parse_dates=["first_interaction", "last_interaction"],
    )
    if not interactions.empty:
        interactions["first_interaction"] = interactions["first_interaction"].map(
            lambda x: x - tdoff
        )
        interactions["last_interaction"] = interactions["last_interaction"].map(
            lambda x: x - tdoff
        )

    # 4. Per-question scores from question_grades (use grades table as primary source)
    scores = pd.read_sql_query(
        """
        SELECT sid, div_id, score
        FROM question_grades
        WHERE course_name = %(course_name)s
          AND div_id IN %(div_ids)s
        """,
        engine,
        params={"course_name": course_name, "div_ids": div_ids},
    )

    # 5. Class-wide stats per question
    if not interactions.empty:
        int_stats = (
            interactions.groupby("div_id")
            .agg(
                total_interactions=("interactions", "sum"),
                first_interaction=("first_interaction", "min"),
                last_interaction=("last_interaction", "max"),
            )
            .reset_index()
        )
    else:
        int_stats = pd.DataFrame(
            columns=[
                "div_id",
                "total_interactions",
                "first_interaction",
                "last_interaction",
            ]
        )

    if not scores.empty:
        score_stats = (
            scores.groupby("div_id")
            .agg(
                n_correct=("score", lambda x: (x > 0).sum()),
                n_attempted=("score", "count"),
                avg_score=("score", "mean"),
            )
            .reset_index()
        )
        score_stats["n_incorrect"] = (
            score_stats["n_attempted"] - score_stats["n_correct"]
        )
        score_stats["n_never_tried"] = n_enrolled - score_stats["n_attempted"]
    else:
        score_stats = pd.DataFrame(
            columns=[
                "div_id",
                "n_correct",
                "n_incorrect",
                "n_never_tried",
                "avg_score",
            ]
        )

    # 6. Per-student score pivot (student label → score per question)
    # Build label map for all enrolled students regardless of whether they have scores.
    if not enrolled.empty:
        enrolled["label"] = (
            enrolled["last_name"]
            + ", "
            + enrolled["first_name"]
            + " ("
            + enrolled["username"]
            + ")"
        )
        label_map = dict(zip(enrolled["username"], enrolled["label"]))
    else:
        label_map = {}

    if not scores.empty and label_map:
        scores_labeled = scores.copy()
        scores_labeled["label"] = scores_labeled["sid"].map(label_map)
        scores_labeled = scores_labeled.dropna(subset=["label"])
        if not scores_labeled.empty:
            score_pivot = scores_labeled.pivot_table(
                index="div_id",
                columns="label",
                values="score",
                aggfunc="first",
            ).reset_index()
        else:
            score_pivot = pd.DataFrame({"div_id": list(div_ids)})
    else:
        score_pivot = pd.DataFrame({"div_id": list(div_ids)})

    # Ensure every enrolled student has a column, even with no scores at all.
    for label in label_map.values():
        if label not in score_pivot.columns:
            score_pivot[label] = None

    # 7. Merge everything onto the questions frame
    result = questions[["div_id", "question_type", "points", "sorting_priority"]].copy()
    result = result.merge(int_stats, on="div_id", how="left")
    result = result.merge(
        score_stats[
            ["div_id", "n_correct", "n_incorrect", "n_never_tried", "avg_score"]
        ],
        on="div_id",
        how="left",
    )
    result = result.merge(score_pivot, on="div_id", how="left")

    result["total_interactions"] = result["total_interactions"].fillna(0).astype(int)
    result["n_correct"] = result["n_correct"].fillna(0).astype(int)
    result["n_incorrect"] = result["n_incorrect"].fillna(0).astype(int)
    result["n_never_tried"] = result["n_never_tried"].fillna(n_enrolled).astype(int)
    result["avg_score"] = result["avg_score"].fillna(0.0).round(2)

    def _fmt_ts(x):
        try:
            return x.strftime("%Y-%m-%d %H:%M") if pd.notna(x) else ""
        except Exception:
            return ""

    if "first_interaction" in result.columns:
        result["first_interaction"] = result["first_interaction"].map(_fmt_ts)
        result["last_interaction"] = result["last_interaction"].map(_fmt_ts)

    result = result.sort_values("sorting_priority")

    result = result.rename(
        columns={
            "div_id": "Question",
            "question_type": "Type",
            "points": "Points",
            "total_interactions": "Interactions",
            "first_interaction": "First",
            "last_interaction": "Last",
            "n_correct": "# Correct",
            "n_incorrect": "# Incorrect",
            "n_never_tried": "# Never Tried",
            "avg_score": "Avg Score",
        }
    )

    fixed_cols = [
        "Question",
        "Type",
        "# Correct",
        "# Incorrect",
        "# Never Tried",
        "Avg Score",
        "Points",
        "Interactions",
        "First",
        "Last",
    ]
    student_cols = sorted(
        [c for c in result.columns if c not in fixed_cols and c != "sorting_priority"],
        key=lambda x: x.lower(),
    )
    result = result[[c for c in fixed_cols + student_cols if c in result.columns]]

    return json.loads(result.to_json(orient="records", date_format="iso"))


# ---------------------------------------------------------------------------
# Assignment Overview — student drilldown helper
# ---------------------------------------------------------------------------


def _build_assignment_student_detail(
    engine,
    assignment_id: int,
    course_name: str,
    sid: str,
    tz_offset_hours: float,
) -> list:
    """
    Per-question detail for one student within an assignment.
    Returns a list of records (one per question).
    """
    tdoff = pd.Timedelta(hours=tz_offset_hours)

    questions = pd.read_sql_query(
        """
        SELECT q.name AS div_id, q.question_type,
               aq.points AS max_points, aq.sorting_priority
        FROM assignment_questions aq
        JOIN questions q ON q.id = aq.question_id
        WHERE aq.assignment_id = %(assignment_id)s
        ORDER BY aq.sorting_priority
        """,
        engine,
        params={"assignment_id": assignment_id},
    )
    if questions.empty:
        return []

    div_ids = tuple(questions["div_id"].tolist())

    interactions = pd.read_sql_query(
        """
        SELECT div_id,
               COUNT(*) AS interactions,
               MIN(timestamp) AS first_interaction,
               MAX(timestamp) AS last_interaction
        FROM useinfo
        WHERE course_id = %(course_name)s
          AND sid = %(sid)s
          AND div_id IN %(div_ids)s
        GROUP BY div_id
        """,
        engine,
        params={"course_name": course_name, "sid": sid, "div_ids": div_ids},
        parse_dates=["first_interaction", "last_interaction"],
    )
    if not interactions.empty:
        interactions["first_interaction"] = interactions["first_interaction"].map(
            lambda x: x - tdoff
        )
        interactions["last_interaction"] = interactions["last_interaction"].map(
            lambda x: x - tdoff
        )

    scores = pd.read_sql_query(
        """
        SELECT div_id, score
        FROM question_grades
        WHERE course_name = %(course_name)s
          AND sid = %(sid)s
          AND div_id IN %(div_ids)s
        """,
        engine,
        params={"course_name": course_name, "sid": sid, "div_ids": div_ids},
    )

    result = questions[
        ["div_id", "question_type", "max_points", "sorting_priority"]
    ].copy()
    if not interactions.empty:
        result = result.merge(interactions, on="div_id", how="left")
    else:
        result["interactions"] = 0
        result["first_interaction"] = None
        result["last_interaction"] = None
    if not scores.empty:
        result = result.merge(scores, on="div_id", how="left")
    else:
        result["score"] = None

    result["interactions"] = result["interactions"].fillna(0).astype(int)

    def _fmt_ts(x):
        try:
            return x.strftime("%Y-%m-%d %H:%M") if pd.notna(x) else ""
        except Exception:
            return ""

    result["first_interaction"] = result["first_interaction"].map(_fmt_ts)
    result["last_interaction"] = result["last_interaction"].map(_fmt_ts)
    result["score"] = result["score"].apply(
        lambda x: round(float(x), 2) if pd.notna(x) else ""
    )
    result = result.sort_values("sorting_priority")
    result = result.rename(
        columns={
            "div_id": "Question",
            "question_type": "Type",
            "max_points": "Max Points",
            "interactions": "Interactions",
            "first_interaction": "First Interaction",
            "last_interaction": "Last Interaction",
            "score": "Score",
        }
    )
    cols = [
        "Question",
        "Type",
        "Score",
        "Max Points",
        "Interactions",
        "First Interaction",
        "Last Interaction",
    ]
    return json.loads(result[cols].to_json(orient="records"))


# ---------------------------------------------------------------------------
# Assignment Overview — endpoints
# ---------------------------------------------------------------------------


@router.get("/assignmentoverview", response_class=HTMLResponse)
@instructor_role_required()
@with_course()
async def get_assignmentoverview(
    request: Request,
    user=Depends(auth_manager),
    course=None,
    assignment_id: Optional[int] = None,
):
    """Serve the assignment overview report shell page.

    If ``assignment_id`` is supplied as a query parameter the template will
    pre-select that assignment and auto-generate the report on page load.
    """
    engine = create_engine(settings.dburl)
    assignments_df = pd.read_sql_query(
        """
        SELECT a.id, a.name, a.duedate, a.points
        FROM assignments a
        JOIN courses c ON c.id = a.course
        WHERE c.course_name = %(course_name)s and a.is_peer = 'F'
        ORDER BY a.duedate DESC NULLS LAST
        """,
        engine,
        params={"course_name": course.course_name},
    )
    assignments = assignments_df.to_dict(orient="records")
    # Convert Timestamps to strings for template rendering
    for row in assignments:
        dt = row.get("duedate")
        if dt is not None and pd.notna(dt):
            try:
                row["duedate"] = dt.strftime("%Y-%m-%d")
            except Exception:
                row["duedate"] = str(dt)
        else:
            row["duedate"] = ""

    context = {
        "request": request,
        "user": user,
        "course": course,
        "assignments": assignments,
        "auto_assignment_id": assignment_id,
        "is_instructor": True,
        "student_page": False,
        "settings": settings,
    }
    return templates.TemplateResponse(
        "admin/analytics/assignmentoverview.html", context
    )


@router.post("/assignmentoverview/generate")
@instructor_role_required()
@with_course()
async def generate_assignmentoverview(
    request: Request,
    background_tasks: BackgroundTasks,
    user=Depends(auth_manager),
    course=None,
    RS_info: Optional[str] = Cookie(None),
):
    """Kick off a background report for the chosen assignment."""
    body = await request.json()
    assignment_id = body.get("assignment_id")
    if not assignment_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="assignment_id is required",
        )

    tz_offset_hours = 0.0
    if RS_info:
        try:
            tz_offset_hours = float(json.loads(RS_info).get("tz_offset", 0))
        except Exception:
            rslogger.warning("Could not parse RS_info cookie for tz_offset")

    task_id = str(uuid.uuid4())
    r = _get_redis()
    _set_ao_task(r, task_id, {"status": "pending"})

    background_tasks.add_task(
        _build_assignment_report,
        task_id=task_id,
        assignment_id=int(assignment_id),
        course_name=course.course_name,
        tz_offset_hours=tz_offset_hours,
    )

    rslogger.info(
        f"Queued assignmentoverview task {task_id} for {course.course_name} "
        f"assignment_id={assignment_id}"
    )
    return JSONResponse(
        {"task_id": task_id, "status": "pending", "assignment_id": assignment_id}
    )


@router.get("/assignmentoverview/result/{task_id}")
@instructor_role_required()
async def get_assignmentoverview_result(
    task_id: str,
    request: Request,
    user=Depends(auth_manager),
):
    """Poll Redis for the status/result of an assignment report task."""
    r = _get_redis()
    payload = _get_ao_task(r, task_id)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or expired",
        )
    return JSONResponse(payload)


@router.get("/assignmentoverview/csv/{task_id}")
@instructor_role_required()
@with_course()
async def download_assignmentoverview_csv(
    task_id: str,
    request: Request,
    user=Depends(auth_manager),
    course=None,
):
    """Stream the cached assignment report as a CSV download."""
    r = _get_redis()
    payload = _get_ao_task(r, task_id)
    if payload is None or payload.get("status") != "complete":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found, not yet complete, or expired",
        )
    df = pd.DataFrame(payload["data"])
    csv_content = df.to_csv(index=False, na_rep="")
    filename = f"assignment_report_{course.course_name}.csv"
    return StreamingResponse(
        iter([csv_content]),
        media_type="application/vnd.ms-excel",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/assignmentoverview/student", response_class=HTMLResponse)
@instructor_role_required()
@with_course()
async def get_assignment_student_detail(
    request: Request,
    sid: str,
    assignment_id: int,
    user=Depends(auth_manager),
    course=None,
    RS_info: Optional[str] = Cookie(None),
):
    """Render the per-student drilldown for an assignment."""
    tz_offset_hours = 0.0
    if RS_info:
        try:
            tz_offset_hours = float(json.loads(RS_info).get("tz_offset", 0))
        except Exception:
            rslogger.warning("Could not parse RS_info cookie for tz_offset")

    engine = create_engine(settings.dburl)

    student_row = pd.read_sql_query(
        """
        SELECT username, first_name, last_name, email
        FROM auth_user WHERE username = %(sid)s LIMIT 1
        """,
        engine,
        params={"sid": sid},
    )
    if student_row.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student '{sid}' not found",
        )
    student = student_row.iloc[0].to_dict()

    assignment_row = pd.read_sql_query(
        """
        SELECT id, name, duedate, points
        FROM assignments WHERE id = %(assignment_id)s LIMIT 1
        """,
        engine,
        params={"assignment_id": assignment_id},
    )
    if assignment_row.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment {assignment_id} not found",
        )
    assignment = assignment_row.iloc[0].to_dict()
    dt = assignment.get("duedate")
    if dt is not None and pd.notna(dt):
        try:
            assignment["duedate"] = dt.strftime("%Y-%m-%d")
        except Exception:
            assignment["duedate"] = str(dt)
    else:
        assignment["duedate"] = ""

    detail = _build_assignment_student_detail(
        engine, assignment_id, course.course_name, sid, tz_offset_hours
    )

    # Total assignment grade from grades table
    total_grade_row = pd.read_sql_query(
        """
        SELECT g.score
        FROM grades g
        JOIN auth_user u ON u.id = g.auth_user
        WHERE u.username = %(sid)s AND g.assignment = %(assignment_id)s
        LIMIT 1
        """,
        engine,
        params={"sid": sid, "assignment_id": assignment_id},
    )
    total_score = None
    if not total_grade_row.empty:
        raw = total_grade_row.iloc[0]["score"]
        if raw is not None and pd.notna(raw):
            total_score = round(float(raw), 2)

    context = {
        "request": request,
        "user": user,
        "course": course,
        "student": student,
        "assignment": assignment,
        "detail_json": json.dumps(detail),
        "total_score": total_score,
        "is_instructor": True,
        "student_page": False,
        "settings": settings,
    }
    return templates.TemplateResponse(
        "admin/analytics/assignment_student_detail.html", context
    )


@router.get("/student_detail", response_class=HTMLResponse)
@instructor_role_required()
@with_course()
async def get_student_detail(
    request: Request,
    sid: str,
    user=Depends(auth_manager),
    course=None,
    RS_info: Optional[str] = Cookie(None),
):
    """
    Render the student drilldown page.

    Queries are run synchronously (single-student data is manageable without
    a background task). Results are embedded directly in the rendered template.
    """
    tz_offset_hours = 0.0
    if RS_info:
        try:
            parsed_rs = json.loads(RS_info)
            tz_offset_hours = float(parsed_rs.get("tz_offset", 0))
        except Exception:
            rslogger.warning("Could not parse RS_info cookie for tz_offset")

    engine = create_engine(settings.dburl)

    # Basic student info
    student_row = pd.read_sql_query(
        """
        select username, first_name, last_name, email
        from auth_user
        where username = %(sid)s
        limit 1
        """,
        engine,
        params={"sid": sid},
    )
    if student_row.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student '{sid}' not found",
        )
    student = student_row.iloc[0].to_dict()

    data = _build_student_detail(
        engine,
        course_name=course.course_name,
        base_course=course.base_course,
        sid=sid,
        tz_offset_hours=tz_offset_hours,
    )

    context = {
        "request": request,
        "user": user,
        "course": course,
        "student": student,
        "subchapter_summary_json": json.dumps(data["subchapter_summary"]),
        "exercise_detail_json": json.dumps(data["exercise_detail"]),
        "is_instructor": True,
        "student_page": False,
        "settings": settings,
    }
    return templates.TemplateResponse("admin/analytics/student_detail.html", context)
