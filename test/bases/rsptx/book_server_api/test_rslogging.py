"""
Functional tests for POST /logger/bookevent.

Requires a running PostgreSQL instance (TEST_DBURL) with the test schema
initialised via the ``init_test_db`` session fixture.

All requests are authenticated as ``testuser1`` via the ``auth_book_client``
fixture, which overrides the ``auth_manager`` FastAPI dependency.

Tests are async functions so they share the session event loop with the
asyncpg connection pool — using httpx.AsyncClient + ASGITransport instead
of TestClient avoids the "attached to a different loop" error.
"""

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

COURSE = "test_course_1"


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _bookevent(event, act, div_id, **extra):
    payload = {
        "event": event,
        "act": act,
        "div_id": div_id,
        "course_name": COURSE,
    }
    payload.update(extra)
    return payload


# ---------------------------------------------------------------------------
# /logger/bookevent
# ---------------------------------------------------------------------------


async def test_bookevent_page_view(auth_book_client):
    """A simple page-view event is accepted and returns 2xx."""
    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent("page", "view", "ch1_introduction"),
    )
    assert resp.status_code in (200, 201)


async def test_bookevent_mchoice(auth_book_client):
    """A multiple-choice answer event is accepted and returns 2xx."""
    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent(
            "mChoice",
            "answer:A:correct",
            "ch1_q1",
            answer="A",
            correct=True,
        ),
    )
    assert resp.status_code in (200, 201)


async def test_bookevent_fillb(auth_book_client):
    """A fill-in-the-blank answer event is accepted and returns 2xx."""
    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent(
            "fillb",
            "answer:hello:correct",
            "ch1_q2",
            answer="hello",
            correct=True,
            percent=1.0,
        ),
    )
    assert resp.status_code in (200, 201)


async def test_bookevent_shortanswer(auth_book_client):
    """A short-answer event is accepted and returns 2xx."""
    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent(
            "shortanswer",
            "answer:This is my answer",
            "ch1_sa1",
            answer="This is my answer",
        ),
    )
    assert resp.status_code in (200, 201)


# ---------------------------------------------------------------------------
# interaction-only events (video, poll)
#
# These have no answer table -- the useinfo row is the whole submission -- so
# they need their own path through the scorer.  The seeded testuser1 is
# enrolled in "overview", so the assignment has to live there for is_assigned()
# to find it.
# ---------------------------------------------------------------------------

STUDENT_COURSE = "overview"


async def _assign_interaction_question(
    student_user, div_id, question_type, points=5, autograde="interact"
):
    """Seed a question, an open assignment and the link between them, and
    return the assignment id."""
    import datetime

    from rsptx.db.async_session import async_session
    from rsptx.db.models import Assignment, AssignmentQuestion, Question

    async with async_session.begin() as session:
        question = Question(
            base_course=STUDENT_COURSE,
            name=div_id,
            chapter="ch1",
            subchapter="sub1",
            question_type=question_type,
            timestamp=datetime.datetime(2024, 1, 1),
            from_source=False,
        )
        session.add(question)
        await session.flush()

        assignment = Assignment(
            course=student_user.course_id,
            name=f"assign_{div_id}",
            points=points,
            released=False,
            duedate=datetime.datetime(2099, 1, 1),
            visible=True,
            from_source=False,
            is_timed=False,
            kind="Regular",
        )
        session.add(assignment)
        await session.flush()

        session.add(
            AssignmentQuestion(
                assignment_id=assignment.id,
                question_id=question.id,
                points=points,
                autograde=autograde,
                which_to_grade="best_answer",
                reading_assignment=False,
                sorting_priority=1,
            )
        )
        return assignment.id


async def _question_grade(div_id):
    from rsptx.db.crud import fetch_question_grade

    return await fetch_question_grade("testuser1", STUDENT_COURSE, div_id)


async def test_video_play_is_graded(auth_book_client, student_user):
    """Playing an assigned video graded on interaction awards full points.

    This is the regression test for videos in the exercises section scoring 0:
    "video" is not in EVENT2TABLE, so the event used to skip the scorer
    entirely and no question_grades row was ever written."""
    div_id = "interaction_video_play"
    await _assign_interaction_question(student_user, div_id, "youtube")

    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent("video", "play:12.5", div_id, course_name=STUDENT_COURSE),
    )
    assert resp.status_code in (200, 201)

    grade = await _question_grade(div_id)
    assert grade is not None
    assert grade.score == 5


async def test_video_ready_is_not_graded(auth_book_client, student_user):
    """The player logs "ready" as soon as it is built, before the student has
    done anything, so it must not earn credit."""
    div_id = "interaction_video_ready"
    await _assign_interaction_question(student_user, div_id, "youtube")

    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent("video", "ready", div_id, course_name=STUDENT_COURSE),
    )
    assert resp.status_code in (200, 201)

    assert await _question_grade(div_id) is None


async def test_repeated_video_events_keep_one_grade_row(auth_book_client, student_user):
    """Play/pause/complete all score the same, and upsert a single row rather
    than colliding with the question_grades unique index."""
    div_id = "interaction_video_repeat"
    await _assign_interaction_question(student_user, div_id, "youtube", points=3)

    for act in ("play:0", "pause:8.25", "play:8.25", "complete"):
        resp = await auth_book_client.post(
            "/logger/bookevent",
            json=_bookevent("video", act, div_id, course_name=STUDENT_COURSE),
        )
        assert resp.status_code in (200, 201)

    grade = await _question_grade(div_id)
    assert grade is not None
    assert grade.score == 3


async def test_poll_response_is_graded(auth_book_client, student_user):
    """Polls have the same shape as videos: no answer table, graded on
    interaction."""
    div_id = "interaction_poll_1"
    await _assign_interaction_question(student_user, div_id, "poll", points=2)

    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent("poll", "3", div_id, course_name=STUDENT_COURSE),
    )
    assert resp.status_code in (200, 201)

    grade = await _question_grade(div_id)
    assert grade is not None
    assert grade.score == 2


async def test_unassigned_video_is_not_graded(auth_book_client):
    """A video watched in the book but not part of any assignment is logged
    only -- no grade row appears."""
    div_id = "interaction_video_unassigned"
    resp = await auth_book_client.post(
        "/logger/bookevent",
        json=_bookevent("video", "play:1", div_id, course_name=STUDENT_COURSE),
    )
    assert resp.status_code in (200, 201)

    assert await _question_grade(div_id) is None


async def test_bookevent_missing_required_fields(auth_book_client):
    """A request missing required fields returns 422."""
    resp = await auth_book_client.post(
        "/logger/bookevent",
        json={"event": "page"},  # missing act, div_id, course_name
    )
    assert resp.status_code == 422


async def test_bookevent_empty_body(auth_book_client):
    """An empty body returns 422."""
    resp = await auth_book_client.post("/logger/bookevent", json={})
    assert resp.status_code == 422
