"""
Connection pool and event-loop instrumentation.

Answers two questions that look alike in the logs but have opposite fixes:

1. *Is the connection pool the bottleneck?* -- the symptom is
   ``QueuePool limit of size N overflow M reached, connection timed out``.
   Watch ``checked_out`` against ``capacity``. If the high-water mark sits at
   capacity, raise ``DB_POOL_SIZE``/``DB_MAX_OVERFLOW`` (cheap behind pgbouncer
   in transaction mode, where a pool slot is not a real backend).

2. *Is this process the bottleneck?* -- the symptom is the same timeout, but
   the pool is nowhere near full. What actually happened is that something
   blocked the event loop, so the tasks holding connections could not run to
   release them. Watch ``loop_lag_ms``. A single-process uvicorn (which is what
   the compose file runs -- ``UVICORN_WORKERS`` is not passed to uvicorn) has
   exactly one event loop, so one slow synchronous call stalls every request in
   flight.

Lag is measured the standard way: sleep a known interval and see how late we
wake up. An idle, healthy loop wakes within a millisecond or two. Sustained
tens of milliseconds means the loop is busy; hundreds means something
synchronous is running on it and wants ``asyncio.to_thread``.

Only when lag is *low* and the pool is *full* does adding worker processes
help; the reverse means the fix is to get blocking work off the loop.

Lag alone cannot say what blocked the loop, so a watchdog thread also samples
the event loop thread's stack whenever the loop has been stuck for
``LOOP_STALL_DUMP_MS`` (default 500ms) and logs it once the stall ends, as
``db pool: event loop blocked for NNNms serving GET /path``. The stack's
innermost frames are the code to fix.
"""

from __future__ import annotations

import asyncio
import collections
import os
import sys
import threading
import time
import traceback
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import event

from rsptx.logging import rslogger

# How often to sample the event loop. Cheap: one timer wakeup.
#
# Only lag is sampled. Pool occupancy is counted exactly, from checkout/checkin
# events -- polling it on this interval missed short checkouts entirely and
# reported a high-water mark of zero while the pool was demonstrably in use.
SAMPLE_INTERVAL_SECONDS = 0.5

# How often to emit the summary log line, and the window the "recent" numbers
# below cover. Five minutes keeps this to ~288 lines per process per day.
LOG_INTERVAL_SECONDS = 300.0

# Warn as soon as the pool crosses this fraction of capacity, rather than
# waiting up to LOG_INTERVAL_SECONDS to mention it. Re-armed once occupancy
# drops back under the threshold, so a sustained squeeze logs once, not once
# per sample.
SATURATION_WARN_FRACTION = 0.8

# Lag above this is worth calling out on its own; see the module docstring.
LOOP_LAG_WARN_MS = 250.0

# --- Stall watchdog --------------------------------------------------------
#
# The lag numbers above say *that* the loop stalled, never *what* it was
# doing. The watchdog answers that: a heartbeat task bumps a timestamp every
# HEARTBEAT_SECONDS, and a separate thread notices when the heartbeat is
# overdue and samples the event loop thread's Python stack while it is still
# stuck. One warning per stall, naming the request and the line.
#
# Stalls at least this long get a stack dump. 0 disables the watchdog.
STALL_DUMP_MS = float(os.environ.get("LOOP_STALL_DUMP_MS", "500"))
HEARTBEAT_SECONDS = 0.05
WATCHDOG_POLL_SECONDS = 0.1
# Innermost frames kept per stack; the outer ones are uvicorn and asyncio.
STALL_STACK_FRAMES = 25
# Distinct stacks kept per stall. One blocking call samples the same stack
# every time; many different stacks mean a busy loop, not a single culprit.
MAX_STACKS_PER_STALL = 3
# Cap on dumps per LOG_INTERVAL_SECONDS window, so a pathological stretch
# cannot flood the logs. The window's summary says how many were skipped.
MAX_STALL_REPORTS_PER_WINDOW = 20
# A stall still in progress after this long is reported without waiting for
# it to end -- it may never end.
STALL_ONGOING_REPORT_SECONDS = 10.0


@dataclass
class _Window:
    """High-water marks accumulated since the last summary log."""

    async_checked_out: int = 0
    sync_checked_out: int = 0
    loop_lag_ms: float = 0.0
    lag_total_ms: float = 0.0
    samples: int = 0

    def reset(self) -> None:
        self.async_checked_out = 0
        self.sync_checked_out = 0
        self.loop_lag_ms = 0.0
        self.lag_total_ms = 0.0
        self.samples = 0


@dataclass
class _State:
    #: high-water marks since the last summary log
    window: _Window = field(default_factory=_Window)
    #: high-water marks since the process started
    lifetime: _Window = field(default_factory=_Window)
    #: whether a saturation warning is currently armed
    saturation_armed: bool = True
    #: live checkout counts, maintained by the pool event listeners
    live: dict = field(default_factory=lambda: {"async": 0, "sync": 0})
    #: guards ``live`` and the high-water marks; the sync pool is checked
    #: out from worker threads, not just the event loop.
    lock: threading.Lock = field(default_factory=threading.Lock)
    #: whether the pool event listeners have been installed
    listeners_installed: bool = False
    #: monotonic time of the last heartbeat; written only on the event loop
    last_beat: float = 0.0
    #: (beat the stall began after, stall length in ms), appended by the
    #: heartbeat when it wakes late and drained by the watchdog thread
    stall_gaps: collections.deque = field(default_factory=collections.deque)
    #: stall dumps emitted / skipped (over the cap) in the current window
    stall_reports: int = 0
    stall_reports_skipped: int = 0


_state = _State()


def _pool_numbers(pool) -> dict:
    """Describe one SQLAlchemy pool.

    Written against ``QueuePool``'s interface but tolerant of the others:
    SQLite uses pool classes that have no notion of overflow or checkout
    counts, and this is diagnostics -- it must never be the thing that breaks a
    request.

    :param pool: the engine's pool (``engine.pool``).
    :return: size/checked-out/overflow counts, or ``{}`` if unavailable.
    :rtype: dict
    """
    try:
        size = pool.size()
        checked_out = pool.checkedout()
        # _max_overflow is private but stable, and there is no public accessor.
        max_overflow = getattr(pool, "_max_overflow", 0) or 0
        return {
            "kind": type(pool).__name__,
            "size": size,
            "checked_in": pool.checkedin(),
            "checked_out": checked_out,
            "overflow": pool.overflow(),
            "max_overflow": max_overflow,
            "capacity": size + max_overflow,
        }
    except Exception:
        # e.g. SingletonThreadPool/StaticPool under SQLite.
        return {"kind": type(pool).__name__}


def pool_snapshot() -> dict:
    """Return current pool occupancy plus the lag/occupancy high-water marks.

    Safe to call from anywhere, including a request handler; it reads counters
    and does not touch the database.

    :return: a JSON-serializable summary of both engines and the event loop.
    :rtype: dict
    """
    # Imported here rather than at module scope: importing this module must not
    # drag in (and therefore construct) both engines as a side effect.
    from rsptx.db.async_session import engine as async_engine
    from rsptx.db.sync_session import engine as sync_engine

    w, lt = _state.window, _state.lifetime
    mean_lag = (w.lag_total_ms / w.samples) if w.samples else 0.0
    return {
        "async_pool": _pool_numbers(async_engine.pool),
        "sync_pool": _pool_numbers(sync_engine.pool),
        "event_loop": {
            "lag_ms_mean_recent": round(mean_lag, 1),
            "lag_ms_max_recent": round(w.loop_lag_ms, 1),
            "lag_ms_max_lifetime": round(lt.loop_lag_ms, 1),
            "samples_recent": w.samples,
        },
        "in_use": dict(_state.live),
        "high_water": {
            "async_checked_out_recent": w.async_checked_out,
            "async_checked_out_lifetime": lt.async_checked_out,
            "sync_checked_out_recent": w.sync_checked_out,
            "sync_checked_out_lifetime": lt.sync_checked_out,
        },
    }


def _capacity(which: str) -> int:
    """Return ``pool_size + max_overflow`` for one of the engines."""
    from rsptx.db.async_session import engine as async_engine
    from rsptx.db.sync_session import engine as sync_engine

    pool = (async_engine if which == "async" else sync_engine).pool
    return _pool_numbers(pool).get("capacity", 0)


def _on_checkout(which: str, *_args) -> None:
    """Pool ``checkout`` listener: one more connection is in use.

    Fires on the thread doing the checkout -- the event loop for the async
    engine, a worker thread for the sync one -- hence the lock.
    """
    with _state.lock:
        _state.live[which] += 1
        in_use = _state.live[which]
        if which == "async":
            _state.window.async_checked_out = max(
                _state.window.async_checked_out, in_use
            )
            _state.lifetime.async_checked_out = max(
                _state.lifetime.async_checked_out, in_use
            )
        else:
            _state.window.sync_checked_out = max(_state.window.sync_checked_out, in_use)
            _state.lifetime.sync_checked_out = max(
                _state.lifetime.sync_checked_out, in_use
            )
        armed = _state.saturation_armed

    # Say something as soon as the async pool starts to squeeze -- by the time
    # the next summary lands the burst may be long over. Logged outside the
    # lock: rslogger can block on its handlers.
    if which != "async":
        return
    capacity = _capacity("async")
    if not capacity:
        return
    fraction = in_use / capacity
    if fraction >= SATURATION_WARN_FRACTION and armed:
        with _state.lock:
            _state.saturation_armed = False
        rslogger.warning(
            f"db pool: {in_use}/{capacity} connections checked out "
            f"({fraction:.0%}); recent event loop lag "
            f"{_state.window.loop_lag_ms:.0f}ms max. "
            "If lag is low, raise DB_POOL_SIZE/DB_MAX_OVERFLOW; if lag is "
            "high, something is blocking the event loop."
        )


def _on_checkin(which: str, *_args) -> None:
    """Pool ``checkin`` listener: a connection came back."""
    with _state.lock:
        # A pool can check in a connection it never handed us (e.g. on
        # invalidate), so do not let the count go negative.
        _state.live[which] = max(0, _state.live[which] - 1)
        in_use = _state.live[which]
    if which == "async" and not _state.saturation_armed:
        capacity = _capacity("async")
        if capacity and (in_use / capacity) < SATURATION_WARN_FRACTION:
            with _state.lock:
                _state.saturation_armed = True


def install_listeners() -> None:
    """Attach checkout/checkin listeners to both engines.

    Idempotent. Counting events rather than polling is what makes the
    high-water marks trustworthy: a pandas report holds a connection for
    milliseconds, which a twice-a-second poll will usually miss entirely.
    """
    if _state.listeners_installed:
        return
    from rsptx.db.async_session import engine as async_engine
    from rsptx.db.sync_session import engine as sync_engine

    # The async engine's events live on the sync engine it wraps.
    targets = (("async", async_engine.sync_engine), ("sync", sync_engine))
    for which, target in targets:
        event.listen(target, "checkout", lambda *a, _w=which: _on_checkout(_w, *a))
        event.listen(target, "checkin", lambda *a, _w=which: _on_checkin(_w, *a))
    _state.listeners_installed = True


def _sample(lag_ms: float) -> None:
    """Fold one event-loop lag observation into the running statistics."""
    with _state.lock:
        w, lt = _state.window, _state.lifetime
        w.samples += 1
        w.lag_total_ms += lag_ms
        w.loop_lag_ms = max(w.loop_lag_ms, lag_ms)
        lt.loop_lag_ms = max(lt.loop_lag_ms, lag_ms)


def _log_summary() -> None:
    """Emit the periodic summary line and start a new window."""
    snap = pool_snapshot()
    a, s, loop = snap["async_pool"], snap["sync_pool"], snap["event_loop"]
    hw = snap["high_water"]
    rslogger.info(
        "db pool: async %s/%s in use (peak %s this window, %s lifetime); "
        "sync %s/%s in use (peak %s); loop lag mean %.1fms max %.1fms "
        "(lifetime max %.1fms)"
        % (
            a.get("checked_out", "?"),
            a.get("capacity", "?"),
            hw["async_checked_out_recent"],
            hw["async_checked_out_lifetime"],
            s.get("checked_out", "?"),
            s.get("capacity", "?"),
            hw["sync_checked_out_recent"],
            loop["lag_ms_mean_recent"],
            loop["lag_ms_max_recent"],
            loop["lag_ms_max_lifetime"],
        )
    )
    if loop["lag_ms_max_recent"] >= LOOP_LAG_WARN_MS:
        rslogger.warning(
            f"db pool: event loop stalled for up to "
            f"{loop['lag_ms_max_recent']:.0f}ms in the last "
            f"{LOG_INTERVAL_SECONDS:.0f}s. Something synchronous is running on "
            "the loop; it belongs in asyncio.to_thread. Adding worker "
            "processes hides this, it does not fix it." + _stall_report_note()
        )
    with _state.lock:
        _state.window.reset()
        _state.stall_reports = 0
        _state.stall_reports_skipped = 0


def _stall_report_note() -> str:
    """Point the lag warning at the watchdog's stack dumps, if any."""
    if STALL_DUMP_MS <= 0:
        return " (The stall watchdog is off; set LOOP_STALL_DUMP_MS to enable it.)"
    note = (
        f" Stalls over {STALL_DUMP_MS:.0f}ms are logged with the blocking "
        "stack as 'event loop blocked for'."
    )
    if _state.stall_reports_skipped:
        note += (
            f" {_state.stall_reports_skipped} more stalls in this window were "
            f"not dumped (cap {MAX_STALL_REPORTS_PER_WINDOW})."
        )
    return note


# --- Stall watchdog ----------------------------------------------------------


async def _heartbeat(threshold_s: float) -> None:
    """Bump ``_state.last_beat`` on the loop, and record every late wakeup.

    Measuring the gap here, rather than in the watchdog, keeps the stall length
    exact, and it still catches a stall the watchdog never got to sample: a C
    extension that holds the GIL (a huge regex, a big pydantic-core or json
    serialization) starves the watchdog thread too.
    """
    _state.last_beat = time.monotonic()
    while True:
        await asyncio.sleep(HEARTBEAT_SECONDS)
        now = time.monotonic()
        gap = now - _state.last_beat - HEARTBEAT_SECONDS
        if gap >= threshold_s:
            # Appended before last_beat moves, so a watchdog that sees the new
            # beat is guaranteed to find this gap when it drains the queue.
            _state.stall_gaps.append((_state.last_beat, gap * 1000))
        _state.last_beat = now


def _request_of(frame) -> str:
    """``METHOD /path`` of the HTTP request a frame stack is serving, if any.

    Walks outward looking for an ASGI ``scope``. Only the path: the query string
    can carry student data and adds nothing to finding the blocking code.
    """
    while frame is not None:
        try:
            scope = frame.f_locals.get("scope")
        except Exception:
            scope = None
        if isinstance(scope, dict) and scope.get("type") == "http":
            return f"{scope.get('method', '?')} {scope.get('path', '?')}"
        frame = frame.f_back
    return ""


class _StallSamples:
    """Distinct stacks sampled during one stall, with how often each was seen."""

    def __init__(self) -> None:
        self.stacks: dict[str, int] = {}
        self.extra = 0
        self.request = ""
        self.reported_ongoing = False

    def add(self, stack: str, request: str) -> None:
        if stack in self.stacks:
            self.stacks[stack] += 1
        elif len(self.stacks) < MAX_STACKS_PER_STALL:
            self.stacks[stack] = 1
        else:
            self.extra += 1
        self.request = self.request or request


class _StallWatchdog(threading.Thread):
    """Daemon thread that dumps the loop thread's stack while it is blocked."""

    def __init__(self, loop_thread_id: int, threshold_s: float) -> None:
        super().__init__(name="loop-stall-watchdog", daemon=True)
        self.loop_thread_id = loop_thread_id
        self.threshold_s = threshold_s
        self.stopped = threading.Event()
        #: samples per stall, keyed by the heartbeat the stall began after
        self.samples: dict[float, _StallSamples] = {}

    def run(self) -> None:
        while not self.stopped.wait(WATCHDOG_POLL_SECONDS):
            try:
                self._poll()
            except Exception as e:  # pragma: no cover - diagnostics must not break
                rslogger.warning(f"db pool monitor: stall watchdog failed ({e})")
                self.samples.clear()

    def _poll(self) -> None:
        # Read the beat before draining: see _heartbeat for why that order
        # never loses a gap.
        beat = _state.last_beat
        blocked = time.monotonic() - beat - HEARTBEAT_SECONDS
        if blocked >= self.threshold_s:
            samples = self.samples.setdefault(beat, _StallSamples())
            samples.add(*self._loop_stack())
            if blocked >= STALL_ONGOING_REPORT_SECONDS and not samples.reported_ongoing:
                samples.reported_ongoing = True
                self._report(blocked * 1000, samples, ongoing=True)

        while _state.stall_gaps:
            start, gap_ms = _state.stall_gaps.popleft()
            self._report(gap_ms, self.samples.pop(start, None), ongoing=False)

        # A stall that ended just under the threshold leaves samples but no gap.
        for key in [k for k in self.samples if k != beat]:
            del self.samples[key]

    def _loop_stack(self) -> tuple[str, str]:
        frame = sys._current_frames().get(self.loop_thread_id)
        if frame is None:
            return "", ""
        stack = traceback.extract_stack(frame)[-STALL_STACK_FRAMES:]
        return "".join(traceback.format_list(stack)), _request_of(frame)

    def _report(
        self, blocked_ms: float, samples: Optional[_StallSamples], ongoing: bool
    ) -> None:
        with _state.lock:
            if _state.stall_reports >= MAX_STALL_REPORTS_PER_WINDOW:
                _state.stall_reports_skipped += 1
                return
            _state.stall_reports += 1

        head = (
            f"db pool: event loop blocked for {'over ' if ongoing else ''}"
            f"{blocked_ms:.0f}ms{' and counting' if ongoing else ''}"
        )
        if samples and samples.request:
            head += f" serving {samples.request}"
        if not samples or not samples.stacks:
            rslogger.warning(
                f"{head}. No stack was captured: the watchdog thread could not "
                "run either, which means the loop was inside C code holding the "
                "GIL (a large regex, json or pydantic serialization, a C "
                "extension) rather than in Python."
            )
            return

        parts = [head + ". Event loop thread stack (innermost call last):"]
        for i, (stack, count) in enumerate(
            sorted(samples.stacks.items(), key=lambda kv: -kv[1])
        ):
            if len(samples.stacks) > 1:
                parts.append(f"--- stack {i + 1}, seen in {count} samples:")
            parts.append(stack.rstrip())
        if len(samples.stacks) > 1 or samples.extra:
            parts.append(
                f"--- {len(samples.stacks) + samples.extra}+ different stacks: the "
                "loop was busy with many callbacks, not stuck in a single call."
            )
        rslogger.warning("\n".join(parts))


def _start_watchdog() -> tuple[Optional[asyncio.Task], Optional[_StallWatchdog]]:
    """Start the heartbeat on the running loop and the watchdog thread."""
    if STALL_DUMP_MS <= 0:
        return None, None
    threshold_s = STALL_DUMP_MS / 1000
    heartbeat = asyncio.create_task(_heartbeat(threshold_s))
    watchdog = _StallWatchdog(threading.get_ident(), threshold_s)
    watchdog.start()
    return heartbeat, watchdog


async def monitor_loop() -> None:
    """Background task: sample the loop and pools, summarize periodically.

    Cancel-safe; the caller owns the task (see ``start_pool_monitor``).
    """
    loop = asyncio.get_running_loop()
    last_log = loop.time()
    rslogger.info(
        f"db pool monitor: sampling every {SAMPLE_INTERVAL_SECONDS}s, "
        f"summarizing every {LOG_INTERVAL_SECONDS:.0f}s, "
        + (
            f"dumping stacks for stalls over {STALL_DUMP_MS:.0f}ms"
            if STALL_DUMP_MS > 0
            else "stall watchdog off"
        )
    )
    heartbeat, watchdog = _start_watchdog()
    try:
        while True:
            before = loop.time()
            await asyncio.sleep(SAMPLE_INTERVAL_SECONDS)
            # However much later than requested we woke up is the loop's backlog.
            lag_ms = max(0.0, (loop.time() - before - SAMPLE_INTERVAL_SECONDS) * 1000)
            try:
                _sample(lag_ms)
                if loop.time() - last_log >= LOG_INTERVAL_SECONDS:
                    _log_summary()
                    last_log = loop.time()
            except Exception as e:  # pragma: no cover - diagnostics must not break
                rslogger.warning(f"db pool monitor: sample failed ({e})")
    finally:
        if heartbeat:
            heartbeat.cancel()
        if watchdog:
            watchdog.stopped.set()


def start_pool_monitor() -> Optional[asyncio.Task]:
    """Start :func:`monitor_loop` as a background task.

    Call from a FastAPI lifespan and cancel the returned task on shutdown.

    :return: the task, or None if there is no running loop.
    :rtype: Optional[asyncio.Task]
    """
    install_listeners()
    try:
        return asyncio.create_task(monitor_loop())
    except RuntimeError:
        rslogger.warning("db pool monitor: no running event loop; not started")
        return None
