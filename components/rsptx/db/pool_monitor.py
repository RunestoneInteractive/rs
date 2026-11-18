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
"""

from __future__ import annotations

import asyncio
import threading
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
            "processes hides this, it does not fix it."
        )
    _state.window.reset()


async def monitor_loop() -> None:
    """Background task: sample the loop and pools, summarize periodically.

    Cancel-safe; the caller owns the task (see ``start_pool_monitor``).
    """
    loop = asyncio.get_running_loop()
    last_log = loop.time()
    rslogger.info(
        f"db pool monitor: sampling every {SAMPLE_INTERVAL_SECONDS}s, "
        f"summarizing every {LOG_INTERVAL_SECONDS:.0f}s"
    )
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
