"""
Tests for the event-loop stall watchdog in ``rsptx.db.pool_monitor``.

These block the loop on purpose with ``time.sleep`` and check that the warning
names the blocking function and the request it was serving. No database.
"""

import asyncio
import threading
import time

import pytest

from rsptx.db import pool_monitor

# No session-scoped fixture is used here; without this, DB tests that run after
# this module fail with "attached to a different loop".
pytestmark = pytest.mark.asyncio(loop_scope="session")

THRESHOLD_S = 0.2


class _Recorder:
    def __init__(self):
        self.warnings = []

    def warning(self, msg, *args, **kwargs):
        self.warnings.append(msg)

    def info(self, msg, *args, **kwargs):
        pass


@pytest.fixture
def watchdog(monkeypatch):
    """A running heartbeat and watchdog with a short threshold and a fresh state."""
    recorder = _Recorder()
    monkeypatch.setattr(pool_monitor, "rslogger", recorder)
    monkeypatch.setattr(pool_monitor, "_state", pool_monitor._State())
    tasks = []

    async def start():
        heartbeat = asyncio.create_task(pool_monitor._heartbeat(THRESHOLD_S))
        await asyncio.sleep(0)  # let the heartbeat take its first beat
        thread = pool_monitor._StallWatchdog(threading.get_ident(), THRESHOLD_S)
        thread.start()
        tasks.append((heartbeat, thread))
        return recorder

    yield start
    for heartbeat, thread in tasks:
        heartbeat.cancel()
        thread.stopped.set()
        thread.join(timeout=2)


def _deliberately_block_the_loop(seconds):
    time.sleep(seconds)


async def _fake_endpoint(scope, seconds):
    # ``scope`` is a local here exactly as it is in an ASGI app frame.
    _deliberately_block_the_loop(seconds)


async def _settle():
    """Give the heartbeat a beat and the watchdog a poll after a stall."""
    await asyncio.sleep(pool_monitor.WATCHDOG_POLL_SECONDS * 4)


async def test_stall_is_reported_with_the_blocking_stack_and_request(watchdog):
    recorder = await watchdog()
    scope = {"type": "http", "method": "POST", "path": "/assessment/gethist"}
    await _fake_endpoint(scope, 0.6)
    await _settle()

    assert len(recorder.warnings) == 1
    msg = recorder.warnings[0]
    assert "event loop blocked for" in msg
    assert "serving POST /assessment/gethist" in msg
    assert "_deliberately_block_the_loop" in msg
    # The measured length comes from the heartbeat, so it is close to real.
    blocked_ms = float(msg.split("blocked for ")[1].split("ms")[0])
    assert 450 <= blocked_ms <= 1000


async def test_no_report_without_a_stall(watchdog):
    recorder = await watchdog()
    for _ in range(5):
        await asyncio.sleep(0.05)
    await _settle()
    assert recorder.warnings == []


async def test_short_block_under_the_threshold_is_not_reported(watchdog):
    recorder = await watchdog()
    _deliberately_block_the_loop(0.05)
    await _settle()
    assert recorder.warnings == []


async def test_stall_with_no_samples_says_the_gil_was_held(monkeypatch):
    """A stall the watchdog never sampled (C code holding the GIL) is still
    reported, from the gap the heartbeat measured."""
    recorder = _Recorder()
    monkeypatch.setattr(pool_monitor, "rslogger", recorder)
    state = pool_monitor._State()
    state.last_beat = time.monotonic()
    state.stall_gaps.append((state.last_beat - 1.0, 900.0))
    monkeypatch.setattr(pool_monitor, "_state", state)

    pool_monitor._StallWatchdog(0, THRESHOLD_S)._poll()

    assert len(recorder.warnings) == 1
    assert "blocked for 900ms" in recorder.warnings[0]
    assert "holding the GIL" in recorder.warnings[0]


async def test_reports_are_capped_per_window(monkeypatch):
    recorder = _Recorder()
    monkeypatch.setattr(pool_monitor, "rslogger", recorder)
    state = pool_monitor._State()
    state.last_beat = time.monotonic()
    for i in range(pool_monitor.MAX_STALL_REPORTS_PER_WINDOW + 3):
        state.stall_gaps.append((float(i), 600.0))
    monkeypatch.setattr(pool_monitor, "_state", state)

    pool_monitor._StallWatchdog(0, THRESHOLD_S)._poll()

    assert len(recorder.warnings) == pool_monitor.MAX_STALL_REPORTS_PER_WINDOW
    assert state.stall_reports_skipped == 3
    assert "3 more stalls" in pool_monitor._stall_report_note()
