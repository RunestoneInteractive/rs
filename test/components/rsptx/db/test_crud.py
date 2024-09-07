from rsptx.db.crud import *
import pytest
import asyncio


@pytest.mark.asyncio
async def test_create_useinfo_entry():
    assert create_useinfo_entry is not None
    # Write the code for the test here.
    # Tip: use the pytest.raises context manager to test for exceptions.
    # create and new entry
    with pytest.raises(Exception):
        create_useinfo_entry(
            sid="test_sid",
            div_id="test_div_id",
            event="test_event",
            act="test_act",
            timestamp="test_timestamp",
            course_id="test_course_id",
            chapter="test_chapter",
            subchapter="test_subchapter",
            session="test_session",
            ip_address="test_ip_address",
        )
    x = await create_useinfo_entry(
        sid="test_sid",
        div_id="test_div_id",
        event="test_event",
        act="test_act",
        timestamp="test_timestamp",
        course_id="test_course_id",
        chapter="test_chapter",
        subchapter="test_subchapter",
        session="test_session",
        ip_address="test_ip_address",
    )
    assert x is not None
    assert x.sid == "test_sid"
    assert x.div_id == "test_div_id"
    assert x.event == "test_event"
    assert x.act == "test_act"
    assert x.timestamp == "test_timestamp"
    assert x.course_id == "test_course_id"
    assert x.chapter == "test_chapter"
    assert x.subchapter == "test_subchapter"
    assert x.session == "test_session"
    assert x.ip_address == "test_ip_address"


@pytest.mark.asyncio
async def test_create_question_grade_entry():
    # Test creating a new QuestionGrade entry
    sid = "test_sid"
    course_name = "test_course"
    qid = "test_qid"
    grade = 85

    # Call the function to create a new QuestionGrade entry
    new_qg = await create_question_grade_entry(sid, course_name, qid, grade)

    # Assert that the returned object is not None
    assert new_qg is not None

    # Assert that the returned object has the correct attributes
    assert new_qg.sid == sid
    assert new_qg.course_name == course_name
    assert new_qg.div_id == qid
    assert new_qg.score == grade
    assert new_qg.comment == "autograded"
