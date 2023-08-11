from rsptx.db.crud import *
import pytest

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



