"""
The peer instruction routes' Redis traffic.

The routes share one asyncio Redis client (``peer.peer_redis()``). These tests
swap in an in-memory fake that records every command in the order Redis would
receive it, so they check what is published and stored without a Redis server.
"""

import datetime
import json

import pytest

from rsptx.assignment_server_api.routers import peer

pytestmark = pytest.mark.asyncio(loop_scope="session")

COURSE_NAME = "test_course_1"


class _FakePipeline:
    def __init__(self, redis):
        self.redis = redis
        self.queued = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def __getattr__(self, name):
        def queue(*args):
            self.queued.append((name, *args))
            return self

        return queue

    async def execute(self):
        results = [self.redis.apply(*cmd) for cmd in self.queued]
        self.queued = []
        return results


class _FakeRedis:
    """Just enough of redis.asyncio.Redis for the peer routes."""

    def __init__(self):
        self.commands = []
        self.hashes = {}

    def apply(self, name, *args):
        self.commands.append((name, *args))
        if name == "hset":
            key, field, value = args
            self.hashes.setdefault(key, {})[field] = (
                value.encode() if isinstance(value, str) else value
            )
            return 1
        if name == "hincrby":
            key, field, amount = args
            h = self.hashes.setdefault(key, {})
            h[field] = str(int(h.get(field, b"0")) + amount).encode()
            return int(h[field])
        if name == "delete":
            (key,) = args
            return 1 if self.hashes.pop(key, None) is not None else 0
        if name == "publish":
            return 1
        raise AssertionError(f"unexpected redis command {name}")

    def pipeline(self, transaction=True):
        return _FakePipeline(self)

    async def hget(self, key, field):
        return self.hashes.get(key, {}).get(field)

    async def delete(self, key):
        return self.apply("delete", key)

    def published(self):
        return [json.loads(c[2]) for c in self.commands if c[0] == "publish"]


@pytest.fixture
def fake_redis(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(peer, "_redis", fake)
    return fake


async def test_student_text_message_is_published_as_the_student(
    auth_student_client, student_user, fake_redis
):
    resp = await auth_student_client.post(
        "/peer/api/publish_message",
        json={"type": "text", "message": "hi", "from": "someone_else"},
    )
    assert resp.status_code == 200
    (sent,) = fake_redis.published()
    # The sender cannot be spoofed from the request body.
    assert sent["from"] != "someone_else"
    assert sent["from"] == student_user.username
    state = fake_redis.hashes[f"{student_user.course_name}_state"]
    assert state["mess_count"] == b"1"


async def test_student_cannot_publish_a_control_message(
    auth_student_client, fake_redis
):
    resp = await auth_student_client.post(
        "/peer/api/publish_message",
        json={"type": "control", "message": "enableVote", "broadcast": True},
    )
    assert resp.status_code == 401
    assert fake_redis.commands == []


async def test_phase_change_is_published_then_stored(
    auth_instructor_client, fake_redis
):
    resp = await auth_instructor_client.post(
        "/peer/api/publish_message",
        json={
            "type": "control",
            "message": "enableVote",
            "broadcast": True,
            "assignment_id": 42,
        },
    )
    assert resp.status_code == 200
    assert [c[0] for c in fake_redis.commands] == ["publish", "hset", "delete"]
    assert fake_redis.commands[1][1:3] == (f"{COURSE_NAME}_state", "current_phase")
    assert fake_redis.commands[2][1] == "assignment_42_state"


async def test_current_state_prefers_the_students_own_phase(
    auth_student_client, student_user, fake_redis
):
    fake_redis.apply(
        "hset",
        f"{student_user.course_name}_state",
        "current_phase",
        '{"message": "enableVote"}',
    )
    resp = await auth_student_client.get("/peer/api/current_state")
    assert resp.json() == {"message": "enableVote"}

    fake_redis.apply(
        "hset", "assignment_7_state", student_user.username, '{"message": "enableChat"}'
    )
    resp = await auth_student_client.get(
        "/peer/api/current_state", params={"assignment_id": 7}
    )
    assert resp.json() == {"message": "enableChat"}


async def test_clear_pairs_deletes_the_partner_map(auth_instructor_client, fake_redis):
    fake_redis.apply("hset", f"partnerdb_{COURSE_NAME}", "a", "[]")
    resp = await auth_instructor_client.post("/peer/clear_pairs")
    assert resp.status_code == 200
    assert f"partnerdb_{COURSE_NAME}" not in fake_redis.hashes


async def test_make_pairs_stores_partners_before_telling_students(
    auth_instructor_client, fake_redis
):
    """Every student gets a partner entry, an enableChat message and a stored
    phase -- and the partner map is written before any enableChat goes out,
    since the chat relay reads it to route the students' messages."""
    from rsptx.db.async_session import async_session
    from rsptx.db.models import MchoiceAnswers

    div_id = "peer_redis_pairs_q"
    start = datetime.datetime(2024, 6, 1, 12, 0, 0)
    students = [f"pr_student_{i}" for i in range(6)]
    async with async_session.begin() as session:
        for i, sid in enumerate(students):
            session.add(
                MchoiceAnswers(
                    timestamp=start + datetime.timedelta(minutes=1),
                    sid=sid,
                    div_id=div_id,
                    course_name=COURSE_NAME,
                    answer=str(i % 2),
                    correct=i % 2 == 0,
                    percent=1.0,
                )
            )

    resp = await auth_instructor_client.post(
        "/peer/api/make_pairs",
        json={
            "div_id": div_id,
            "start_time": start.isoformat(),
            "group_size": 2,
            "assignment_id": 99,
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "success", "groups": 3}

    partners = fake_redis.hashes[f"partnerdb_{COURSE_NAME}"]
    assert sorted(partners) == students
    for sid, raw in partners.items():
        (partner,) = json.loads(raw)
        assert json.loads(partners[partner]) == [sid]

    chats = [m for m in fake_redis.published() if m["message"] == "enableChat"]
    assert sorted(m["to"] for m in chats) == students
    assert sorted(fake_redis.hashes["assignment_99_state"]) == students

    names = [c[0] for c in fake_redis.commands]
    last_partner_write = max(
        i
        for i, c in enumerate(fake_redis.commands)
        if c[0] == "hset" and c[1] == f"partnerdb_{COURSE_NAME}"
    )
    assert last_partner_write < names.index("publish")
