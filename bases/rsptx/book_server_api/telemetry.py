"""Anonymous, opt-out usage telemetry for the book server.

Once a week the book server sends a tiny, anonymous check-in to
``settings.telemetry_url`` so the Runestone project can count installs around
the world and the books they serve. The payload contains NO personal data and
NO IP-derived location -- see :func:`build_payload` for the exact contents.

Operators can disable this entirely with ``TELEMETRY_ENABLED=false``.
"""

import asyncio
import datetime

import aiohttp

from rsptx.configuration import settings
from rsptx.db.crud import build_checkin_payload, get_last_sent, set_last_sent
from rsptx.logging import rslogger

# How often to check in, and how often the loop wakes to re-check.
CHECKIN_INTERVAL = datetime.timedelta(days=7)
LOOP_SLEEP_SECONDS = 6 * 60 * 60  # 6 hours
HTTP_TIMEOUT_SECONDS = 10


async def send_checkin() -> bool:
    """Build and POST a check-in. Returns True on success.

    Never raises -- any failure is logged and swallowed so telemetry can never
    affect book serving.
    """
    try:
        payload = await build_checkin_payload()
        timeout = aiohttp.ClientTimeout(total=HTTP_TIMEOUT_SECONDS)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(settings.telemetry_url, json=payload) as resp:
                if resp.status < 400:
                    rslogger.info(
                        f"telemetry: sent anonymous check-in to {settings.telemetry_url} "
                        f"(instance {payload['instance_id']})"
                    )
                    return True
                rslogger.warning(
                    f"telemetry: check-in returned HTTP {resp.status}; will retry later"
                )
                return False
    except Exception as e:
        rslogger.warning(f"telemetry: check-in failed ({e}); will retry later")
        return False


async def telemetry_loop() -> None:
    """Background task: periodically check in, respecting the opt-out flag."""
    if not settings.telemetry_enabled:
        rslogger.info(
            "telemetry: disabled (TELEMETRY_ENABLED=false); no usage data will be sent"
        )
        return

    rslogger.info(
        "telemetry: enabled. Sends an anonymous weekly check-in "
        "(instance id, version, region, books served, bucketed counts). "
        "Disable with TELEMETRY_ENABLED=false."
    )
    while True:
        try:
            last = await get_last_sent()
            now = datetime.datetime.utcnow()
            if last is None or (now - last) >= CHECKIN_INTERVAL:
                if await send_checkin():
                    await set_last_sent(now)
        except Exception as e:
            rslogger.warning(f"telemetry: loop iteration error ({e})")
        await asyncio.sleep(LOOP_SLEEP_SECONDS)
