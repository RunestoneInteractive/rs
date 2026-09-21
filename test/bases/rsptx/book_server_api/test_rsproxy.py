"""
Tests for the rsproxy router.

Two things are being protected here:

1. The SSRF guard on the image proxy.  The proxied URL is fully user-controlled
   (student Skulpt programs name arbitrary image hosts), so anything that
   resolves inside our own network must be refused.

2. The error mapping of the upstream calls.  These endpoints used to make
   blocking ``requests`` calls from ``async def`` handlers, which stalled the
   event loop for the length of a jobe run.  They are now awaited httpx calls
   with real timeouts, and the failure modes that introduces (timeout,
   transport error, junk body) have to turn into sane statuses rather than a
   500 from the exception handler.

No database and no network: hosts are IP literals so ``getaddrinfo`` never does
a lookup, and upstreams are ``httpx.MockTransport``.

Every test here is async and drives the app through ``ASGITransport`` built by a
plain helper rather than a fixture -- see :func:`book_client` for why that
matters to the database tests that run after these.
"""

import asyncio
from io import BytesIO

import httpx
import pytest
from PIL import Image

from rsptx.book_server_api.main import app
from rsptx.book_server_api.routers import rsproxy


# Run every test in this module on the *session* event loop.
#
# This is not optional.  ``asyncio_default_fixture_loop_scope`` is "session", so
# the database engine that ``init_test_db`` builds lives in the session loop.  An
# async test that depends on no session-scoped fixture -- which is all of these,
# since none of them touch the database -- would otherwise be given a fresh
# function-scoped loop, and tearing that loop down leaves the engine unusable:
# every database test that runs afterwards fails with "attached to a different
# loop".  (pytest-asyncio 0.24 has no ``asyncio_default_test_loop_scope`` ini
# setting; that arrived in 0.26.  Until we upgrade, say it per module.)
pytestmark = pytest.mark.asyncio(loop_scope="session")

# A public IP literal, so _assert_public_host resolves it without a DNS query.
PUBLIC_HOST = "93.184.216.34"
PUBLIC_URL = f"http://{PUBLIC_HOST}/kitten.png"


@pytest.fixture(autouse=True)
def clean_clients():
    """Drop the shared clients around every test, so a mock cannot leak."""
    rsproxy._clients.clear()
    yield
    rsproxy._clients.clear()


def book_client() -> httpx.AsyncClient:
    """Drive the app in *this* test's loop -- no lifespan, no second loop.

    Deliberately a helper and not a fixture.  ``asyncio_default_fixture_loop_scope``
    is ``session``, so a function-scoped *async* fixture is run against the
    session loop and its teardown leaves that loop unusable -- every database
    test after it then fails with "attached to a different loop".
    """
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    )


def png_bytes(size=(800, 600)) -> bytes:
    """A real PNG, so PIL has something genuine to decode."""
    buf = BytesIO()
    Image.new("RGB", size, (30, 90, 150)).save(buf, "png")
    return buf.getvalue()


def install_mock(name: str, handler, **kwargs) -> None:
    """Pre-seed the shared client named ``name`` with a mock transport."""
    rsproxy._clients[name] = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), **kwargs
    )


# ---------------------------------------------------------------------------
# SSRF guard
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "host",
    [
        "127.0.0.1",  # loopback
        "10.0.0.1",  # private
        "192.168.1.5",  # private
        "172.16.0.1",  # private
        "169.254.169.254",  # cloud metadata endpoint
        "0.0.0.0",  # unspecified
        "224.0.0.1",  # multicast
        "localhost",  # resolves to loopback
    ],
)
async def test_assert_public_host_blocks_internal(host):
    with pytest.raises(rsproxy.ImageFetchError):
        await rsproxy._assert_public_host(host)


async def test_assert_public_host_allows_public():
    # Must not raise.
    await rsproxy._assert_public_host(PUBLIC_HOST)


async def test_assert_public_host_rejects_unresolvable():
    with pytest.raises(rsproxy.ImageFetchError):
        await rsproxy._assert_public_host("no-such-host.invalid")


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "gopher://example.com/x",
        "ftp://example.com/x.png",
    ],
)
async def test_safe_image_fetch_rejects_scheme(url):
    with pytest.raises(rsproxy.ImageFetchError):
        await rsproxy.safe_image_fetch(url)


async def test_safe_image_fetch_rejects_internal_target():
    with pytest.raises(rsproxy.ImageFetchError):
        await rsproxy.safe_image_fetch("http://169.254.169.254/latest/meta-data")


# ---------------------------------------------------------------------------
# Image proxy responses
# ---------------------------------------------------------------------------


async def test_imageproxy_thumbnails():
    original = png_bytes((800, 600))
    install_mock(
        "image",
        lambda request: httpx.Response(
            200, content=original, headers={"Content-Type": "image/png"}
        ),
        follow_redirects=False,
    )

    async with book_client() as client:
        resp = await client.get(f"/rsproxy/imageproxy/{PUBLIC_URL}")

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("image/png")
    out = Image.open(BytesIO(resp.content))
    assert out.size[0] <= 320 and out.size[1] <= 240
    assert len(resp.content) < len(original)


async def test_imageproxy_refuses_redirect():
    """A public URL must not be allowed to bounce to an internal one."""
    install_mock(
        "image",
        lambda request: httpx.Response(302, headers={"Location": "http://127.0.0.1/x"}),
        follow_redirects=False,
    )

    async with book_client() as client:
        resp = await client.get(f"/rsproxy/imageproxy/{PUBLIC_URL}")
    assert resp.status_code == 400


async def test_imageproxy_refuses_non_image():
    install_mock(
        "image",
        lambda request: httpx.Response(
            200, content=b"<html>nope</html>", headers={"Content-Type": "text/html"}
        ),
        follow_redirects=False,
    )

    async with book_client() as client:
        resp = await client.get(f"/rsproxy/imageproxy/{PUBLIC_URL}")
    assert resp.status_code == 400


async def test_imageproxy_refuses_declared_oversize():
    install_mock(
        "image",
        lambda request: httpx.Response(
            200,
            content=png_bytes((10, 10)),
            headers={
                "Content-Type": "image/png",
                "Content-Length": str(rsproxy.MAX_IMAGE_BYTES + 1),
            },
        ),
        follow_redirects=False,
    )

    async with book_client() as client:
        resp = await client.get(f"/rsproxy/imageproxy/{PUBLIC_URL}")
    assert resp.status_code == 400


async def test_imageproxy_enforces_cap_while_streaming(monkeypatch):
    """A host that lies about (or omits) Content-Length is still capped."""
    monkeypatch.setattr(rsproxy, "MAX_IMAGE_BYTES", 1024)
    install_mock(
        "image",
        lambda request: httpx.Response(
            200, content=png_bytes((500, 500)), headers={"Content-Type": "image/png"}
        ),
        follow_redirects=False,
    )

    async with book_client() as client:
        resp = await client.get(f"/rsproxy/imageproxy/{PUBLIC_URL}")
    assert resp.status_code == 400


async def test_imageproxy_relays_upstream_404():
    install_mock(
        "image",
        lambda request: httpx.Response(404),
        follow_redirects=False,
    )

    async with book_client() as client:
        resp = await client.get(f"/rsproxy/imageproxy/{PUBLIC_URL}")
    assert resp.status_code == 404
    assert "not found" in resp.text.lower()


# ---------------------------------------------------------------------------
# jobe
# ---------------------------------------------------------------------------


async def test_jobe_run_relays_result():
    install_mock(
        "jobe",
        lambda request: httpx.Response(200, json={"outcome": 15, "stdout": "hi\n"}),
    )

    async with book_client() as client:
        resp = await client.post(
            "/rsproxy/jobeRun", json={"run_spec": {"language_id": "java"}}
        )
    assert resp.status_code == 200
    assert resp.json()["stdout"] == "hi\n"


async def test_jobe_run_times_out_as_504():
    def handler(request):
        raise httpx.ReadTimeout("too slow", request=request)

    install_mock("jobe", handler)

    async with book_client() as client:
        resp = await client.post("/rsproxy/jobeRun", json={"run_spec": {}})
    assert resp.status_code == 504


async def test_jobe_run_transport_error_as_502():
    def handler(request):
        raise httpx.ConnectError("refused", request=request)

    install_mock("jobe", handler)

    async with book_client() as client:
        resp = await client.post("/rsproxy/jobeRun", json={"run_spec": {}})
    assert resp.status_code == 502


async def test_jobe_run_junk_body_as_502():
    install_mock(
        "jobe", lambda request: httpx.Response(200, content=b"<html>502</html>")
    )

    async with book_client() as client:
        resp = await client.post("/rsproxy/jobeRun", json={"run_spec": {}})
    assert resp.status_code == 502


async def test_jobe_check_file_relays_status():
    install_mock("jobe", lambda request: httpx.Response(204))

    async with book_client() as client:
        resp = await client.get("/rsproxy/jobeCheckFile/abc123")
    assert resp.status_code == 204


async def test_jobe_push_file_relays_status():
    install_mock("jobe", lambda request: httpx.Response(204))

    async with book_client() as client:
        resp = await client.put(
            "/rsproxy/jobePushFile/abc123", json={"file_contents": "eA=="}
        )
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# The property the whole change exists for
# ---------------------------------------------------------------------------


async def test_jobe_run_does_not_block_the_event_loop():
    """A slow jobe must not stop the process serving everything else.

    A blocking client would hold the loop for the full upstream delay and the
    ticker below would not advance.  Verified to fail (0 ticks) against a
    handler that calls ``time.sleep``.
    """

    async def slow_handler(request):
        await asyncio.sleep(0.3)
        return httpx.Response(200, json={"outcome": 15})

    install_mock("jobe", slow_handler)

    ticks = 0

    async def ticker():
        nonlocal ticks
        while True:
            await asyncio.sleep(0.01)
            ticks += 1

    tick_task = asyncio.create_task(ticker())
    try:
        async with book_client() as client:
            resp = await client.post("/rsproxy/jobeRun", json={"run_spec": {}})
    finally:
        tick_task.cancel()

    assert resp.status_code == 200
    # ~30 ticks are possible; anything well above zero proves the loop ran.
    assert ticks > 5, f"event loop was blocked during the jobe call ({ticks} ticks)"
