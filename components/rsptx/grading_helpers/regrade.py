from typing import Dict, List, Optional, Union

from pydantic import BaseModel
from sqlalchemy import and_, select

from rsptx.db.async_session import async_session
from rsptx.db.crud import (
    fetch_assignment_scores,
    fetch_deadline_exception,
    fetch_grade,
    fetch_question_grade,
    fetch_users_for_course,
    upsert_grade,
)
from rsptx.db.models import (
    AssignmentValidator,
    AuthUserValidator,
    CoursesValidator,
    GradeValidator,
    QuestionGrade,
    QuestionValidator,
    SelectedQuestion,
    runestone_component_dict,
)
from rsptx.lti1p3.core import attempt_lti1p3_score_update
from rsptx.logging import rslogger
from rsptx.grading_helpers.scoring import (
    score_answer_values,
    score_peer_values,
    PEER_SCORE_SENTINEL,
)


QTYPE_TO_TABLE = {
    "mchoice": "mchoice_answers",
    "fillintheblank": "fitb_answers",
    "parsonsprob": "parsons_answers",
    "activecode": "unittest_answers",
    "actex": "unittest_answers",
    "shortanswer": "shortanswer_answers",
    "clickablearea": "clickablearea_answers",
    "dragndrop": "dragndrop_answers",
    "codelens": "codelens_answers",
    "matching": "matching_answers",
    "webwork": "webwork_answers",
    "hparsons": "microparsons_answers",
    "microparsons": "microparsons_answers",
    "splice": "splice_answers",
}

UNITTEST_TABLE = "unittest_answers"

MANUAL_COMMENT = "autograded"


def _answer_table_for(question_type: str):
    table_name = QTYPE_TO_TABLE.get(question_type)
    if not table_name:
        return None, None
    rcd = runestone_component_dict.get(table_name)
    if not rcd:
        return None, None
    return rcd.model, table_name


class RegradeOptions(BaseModel):
    """Options controlling how a re-grade batch behaves."""

    overwrite_manual: bool = False
    enforce_deadline: bool = True
    recompute_totals: bool = True
    which_to_grade_override: Optional[str] = None


class RegradeDiffItem(BaseModel):
    sid: str
    question_id: int
    div_id: str
    old_score: Optional[float] = None
    new_score: Optional[float] = None
    skipped: Optional[str] = None
    error: Optional[str] = None


class RegradeReport(BaseModel):
    total: int = 0
    changed: int = 0
    skipped_manual: int = 0
    no_submission: int = 0
    errors: int = 0
    items: List[RegradeDiffItem] = []


async def _resolve_selected_div_id(selector_id: str, sid: str) -> Optional[str]:
    """Resolve a selectquestion wrapper to the actual question a student saw."""
    async with async_session() as session:
        res = await session.execute(
            select(SelectedQuestion.selected_id).where(
                and_(
                    SelectedQuestion.selector_id == selector_id,
                    SelectedQuestion.sid == sid,
                )
            )
        )
        return res.scalars().first()


async def _fetch_answer_rows(tbl, div_id: str, course_name: str, sid: str):
    async with async_session() as session:
        res = await session.execute(
            select(tbl)
            .where(
                and_(
                    tbl.div_id == div_id,
                    tbl.course_name == course_name,
                    tbl.sid == sid,
                )
            )
            .order_by(tbl.timestamp.asc())
        )
        return [row for row in res.scalars()]


def _effective_deadline(assignment: AssignmentValidator, accommodation):
    deadline = assignment.duedate
    if deadline is None:
        return None
    if accommodation and getattr(accommodation, "duedate", None):
        from datetime import timedelta

        deadline = deadline + timedelta(days=accommodation.duedate)
    return deadline


async def _score_row(
    how_to_score: Optional[str],
    max_score: Union[int, float],
    row,
    table_name: str,
    sid: str,
    div_id: str,
    course_name: str,
) -> Union[int, float]:
    event = "unittest" if table_name == UNITTEST_TABLE else None
    correct = getattr(row, "correct", None)
    percent = getattr(row, "percent", None)
    score = score_answer_values(
        how_to_score=how_to_score,
        max_score=max_score,
        correct=correct,
        percent=percent,
        event=event,
    )
    if score == PEER_SCORE_SENTINEL:
        from rsptx.db.crud import fetch_peer_useinfo

        rows = await fetch_peer_useinfo(sid, div_id, course_name)
        has_vote1 = any("vote1" in (r.act or "") for r in rows)
        has_vote2 = any("vote2" in (r.act or "") for r in rows)
        sent_message = any(r.event == "sendmessage" for r in rows)
        return score_peer_values(
            how_to_score, max_score, has_vote1, has_vote2, sent_message
        )
    return score


async def regrade_one(
    course: CoursesValidator,
    sid: str,
    question: QuestionValidator,
    aq,
    assignment: AssignmentValidator,
    options: RegradeOptions,
    dry_run: bool = False,
) -> RegradeDiffItem:
    """Recompute the grade for a single (student, question) pair.

    Mirrors the legacy ``_autograde_one_q`` behaviour: it protects manual
    grades, resolves ``selectquestion`` wrappers, applies deadline accounting,
    selects answers by ``which_to_grade`` and writes the ``question_grades`` row.
    """
    div_id = question.name
    item = RegradeDiffItem(sid=sid, question_id=question.id, div_id=div_id)

    try:
        existing = await fetch_question_grade(sid, course.course_name, div_id)
        if existing is not None and existing.score is not None:
            item.old_score = float(existing.score)
        if (
            existing is not None
            and existing.score is not None
            and existing.comment != MANUAL_COMMENT
            and not options.overwrite_manual
        ):
            item.skipped = "manual"
            item.new_score = item.old_score
            return item

        scoring_type = question.question_type
        scoring_div_id = div_id
        if question.question_type == "selectquestion":
            resolved = await _resolve_selected_div_id(div_id, sid)
            if resolved:
                scoring_div_id = resolved
                from rsptx.db.crud import fetch_question

                real_q = await fetch_question(resolved)
                if real_q:
                    scoring_type = real_q.question_type

        tbl, table_name = _answer_table_for(scoring_type)
        if tbl is None:
            item.skipped = "no_table"
            return item

        rows = await _fetch_answer_rows(tbl, scoring_div_id, course.course_name, sid)

        if options.enforce_deadline:
            accommodation = await fetch_deadline_exception(
                course.id, sid, assignment.id
            )
            deadline = _effective_deadline(assignment, accommodation)
            if deadline is not None:
                rows = [
                    r
                    for r in rows
                    if r.timestamp is not None and r.timestamp <= deadline
                ]

        if not rows:
            item.skipped = "no_submission"
            return item

        which = options.which_to_grade_override or aq.which_to_grade
        max_score = aq.points or 0

        async def score_of(row):
            return await _score_row(
                aq.autograde,
                max_score,
                row,
                table_name,
                sid,
                scoring_div_id,
                course.course_name,
            )

        if which == "first_answer":
            new_score = await score_of(rows[0])
        elif which == "best_answer":
            scores = [await score_of(r) for r in rows]
            new_score = max(scores) if scores else 0
        else:
            new_score = await score_of(rows[-1])

        if new_score is None:
            new_score = 0
        item.new_score = float(new_score)

        if not dry_run:
            await _upsert_autograde(sid, course.course_name, div_id, new_score)

        return item
    except Exception as e:  # pragma: no cover - defensive
        rslogger.error(f"regrade_one failed sid={sid} div={div_id}: {e}")
        item.error = str(e)
        return item


async def _upsert_autograde(
    sid: str, course_name: str, div_id: str, score: Union[int, float]
):
    async with async_session.begin() as session:
        res = await session.execute(
            select(QuestionGrade).where(
                and_(
                    QuestionGrade.sid == sid,
                    QuestionGrade.course_name == course_name,
                    QuestionGrade.div_id == div_id,
                )
            )
        )
        row = res.scalars().first()
        if row is None:
            session.add(
                QuestionGrade(
                    sid=sid,
                    course_name=course_name,
                    div_id=div_id,
                    score=score,
                    comment=MANUAL_COMMENT,
                )
            )
        else:
            row.score = score
            row.comment = MANUAL_COMMENT


def apply_threshold_score(
    total: float, points: Optional[int], threshold_pct: Optional[float]
) -> float:
    """Apply an assignment's threshold scoring rule to a computed total.

    Mirrors the legacy web2py rule (``rs_grading.py``): when a positive
    ``threshold_pct`` (a fraction in 0..1) is set and the earned fraction
    (``total / points``) strictly exceeds it, the student is awarded the full
    ``points``. A null or zero ``threshold_pct`` (or non-positive ``points``)
    is a no-op and the raw ``total`` is returned unchanged.
    """
    if threshold_pct and points and total / points > threshold_pct:
        return points
    return total


async def _recompute_total_for_user(
    user: AuthUserValidator, assignment: AssignmentValidator
) -> None:
    grade = await fetch_grade(user.id, assignment.id)
    if grade and grade.manual_total:
        return

    res = await fetch_assignment_scores(assignment.id, user.course_name, user.username)
    total = 0
    for row in res:
        total += row.score or 0

    total = apply_threshold_score(total, assignment.points, assignment.threshold_pct)

    if grade:
        grade.score = total
        new_grade = grade
    else:
        new_grade = GradeValidator(
            auth_user=user.id,
            course_name=user.course_name,
            assignment=assignment.id,
            score=total,
            manual_total=False,
        )
    await upsert_grade(new_grade)
    await attempt_lti1p3_score_update(user.id, assignment.id, total)


async def recompute_totals_for(
    course: CoursesValidator,
    assignment: AssignmentValidator,
    sids: Optional[List[str]] = None,
) -> int:
    """Recompute assignment totals (and push LTI 1.3 scores) for the given
    students. When ``sids`` is empty/None every student in the course is
    recomputed. Returns the number of students processed.

    This is used by the manual multi-grade flow, where individual grades are
    written through ``POST /grade`` (which does not itself recompute totals).
    """
    users = await fetch_users_for_course(course.course_name)
    user_map: Dict[str, AuthUserValidator] = {u.username: u for u in users}

    if sids:
        targets = [user_map[s] for s in sids if s in user_map]
    else:
        targets = list(user_map.values())

    processed = 0
    for user in targets:
        try:
            await _recompute_total_for_user(user, assignment)
            processed += 1
        except Exception as e:  # pragma: no cover - defensive
            rslogger.error(f"recompute totals failed sid={user.username}: {e}")
    return processed


async def regrade_batch(
    course: CoursesValidator,
    sids: List[str],
    questions: List[tuple],
    assignment: AssignmentValidator,
    options: RegradeOptions,
    dry_run: bool = False,
) -> RegradeReport:
    """Run a re-grade over the student x question matrix.

    ``questions`` is a list of ``(QuestionValidator, AssignmentQuestion)`` tuples.
    When ``dry_run`` is true nothing is written to the database; the returned
    report contains the before/after diff so the UI can preview the operation.
    """
    report = RegradeReport()
    affected_sids: set = set()

    for sid in sids:
        for question, aq in questions:
            item = await regrade_one(
                course, sid, question, aq, assignment, options, dry_run=dry_run
            )
            report.items.append(item)
            report.total += 1
            if item.error:
                report.errors += 1
            elif item.skipped == "manual":
                report.skipped_manual += 1
            elif item.skipped == "no_submission":
                report.no_submission += 1
            elif item.new_score != item.old_score:
                report.changed += 1
                affected_sids.add(sid)

    if not dry_run and options.recompute_totals and affected_sids:
        users = await fetch_users_for_course(course.course_name)
        user_map: Dict[str, AuthUserValidator] = {u.username: u for u in users}
        for sid in affected_sids:
            user = user_map.get(sid)
            if user is not None:
                try:
                    await _recompute_total_for_user(user, assignment)
                except Exception as e:  # pragma: no cover - defensive
                    rslogger.error(f"recompute totals failed sid={sid}: {e}")

    return report
