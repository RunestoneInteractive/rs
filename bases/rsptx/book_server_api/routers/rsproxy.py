# ***********************************
# |docname| - Provide code advice
# ***********************************
# Endpoints to provide various kinds of advice (syntax/style/etc...)
# about code samples
#
# Every endpoint in this file proxies a request to an upstream service (jobe,
# the pytutor tracer, an arbitrary image host).  They are all ``async def``, so
# the network calls **must** be awaited rather than made with a blocking client:
# a blocking call here stalls the whole event loop for every other request the
# process is serving, which is exactly what the pool monitor reports as
# ``event loop stalled for up to Nms``.  See ``notes/connection_pool_monitoring.md``.
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import asyncio
import ipaddress
import socket
from typing import Dict, Optional, Tuple
from urllib.parse import urlparse
from PIL import Image
from io import BytesIO

# Third-party imports
# -------------------
from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
import httpx

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from rsptx.configuration.core import settings

# .. _APIRouter config:
#
# Routing
# =======
# Setup the router object for the endpoints defined in this file.  These will
# be `connected <included routing>` to the main application in `../main.py`.
router = APIRouter(
    # shortcut so we don't have to repeat this part
    prefix="/rsproxy",
    tags=["rsproxy"],
)


# HTTP clients
# ============
# Timeouts. Every upstream call is bounded; a hung upstream must not pin a
# request (or, before these calls were made async, the entire event loop)
# forever.  The jobe read timeout is generous because it has to cover a full
# compile-and-run of student code.
JOBE_TIMEOUT = httpx.Timeout(connect=5.0, read=90.0, write=30.0, pool=10.0)
# The tracer keeps the 30s budget the previous ``requests`` call used.
TRACE_TIMEOUT = httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=10.0)
IMAGE_TIMEOUT = httpx.Timeout(connect=5.0, read=10.0, write=10.0, pool=10.0)

# Shared clients, created on first use and reused thereafter: that is what keeps
# connections pooled and TLS handshakes amortized across requests.  Building one
# per request would throw the pool away every time.
#
# No lock is needed around creation.  ``httpx.AsyncClient(...)`` is synchronous,
# so there is no ``await`` between the miss and the store and no other task can
# interleave.  ``main.py`` closes these at shutdown via :func:`close_clients`.
_clients: Dict[str, httpx.AsyncClient] = {}


def _client(name: str, **kwargs) -> httpx.AsyncClient:
    """Return the shared :class:`httpx.AsyncClient` named ``name``, creating it
    on first use with ``kwargs``.
    """
    client = _clients.get(name)
    if client is None or client.is_closed:
        client = httpx.AsyncClient(**kwargs)
        _clients[name] = client
    return client


def jobe_client() -> httpx.AsyncClient:
    """Client for the jobe code-runner."""
    headers = {
        "Content-type": "application/json; charset=utf-8",
        "Accept": "application/json",
    }
    if settings.jobe_key:
        headers["X-API-KEY"] = settings.jobe_key
    return _client("jobe", timeout=JOBE_TIMEOUT, headers=headers)


def trace_client() -> httpx.AsyncClient:
    """Client for the pytutor trace server."""
    return _client("trace", timeout=TRACE_TIMEOUT)


def image_client() -> httpx.AsyncClient:
    """Client for the image proxy.

    ``follow_redirects`` is off by design: see :func:`safe_image_fetch`.
    """
    return _client("image", timeout=IMAGE_TIMEOUT, follow_redirects=False)


async def close_clients() -> None:
    """Close every shared client.  Called from the app's lifespan shutdown."""
    for name, client in list(_clients.items()):
        try:
            await client.aclose()
        except Exception as e:  # pragma: no cover - shutdown best effort
            rslogger.warning(f"Error closing the {name} http client: {e}")
    _clients.clear()


# SSRF protections for the image proxy
# ------------------------------------
# The image proxy fetches a fully user-controlled URL (student Skulpt image
# programs reference arbitrary public images), so we cannot use a host
# allow-list.  Instead we permit any *public* URL and block anything that
# resolves into our own network.
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB cap on the fetched body
# Bound the decoded pixel count to guard against decompression bombs.
Image.MAX_IMAGE_PIXELS = 64_000_000  # ~64 megapixels


class ImageFetchError(Exception):
    """Raised when an image URL is unsafe or cannot be safely retrieved."""


class ImageUpstreamError(Exception):
    """Raised when the image host answered, but not with an image we can use.

    Carries the upstream status so the endpoint can relay it, which is what the
    Skulpt image code keys off of.
    """

    def __init__(self, status_code: int, message: str = ""):
        super().__init__(message or f"upstream returned {status_code}")
        self.status_code = status_code


async def _assert_public_host(host: str) -> None:
    """Resolve ``host`` and raise :class:`ImageFetchError` if any resolved
    address is private, loopback, link-local, reserved, multicast, or
    unspecified.  This is the core SSRF guard: it blocks the cloud metadata
    endpoint (169.254.169.254) and anything inside our own network.

    Resolution goes through the loop's ``getaddrinfo``, which runs the blocking
    lookup in a thread; calling :func:`socket.getaddrinfo` directly would stall
    the event loop for the length of a DNS round trip (seconds, on a miss).
    """
    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(host, None)
    except socket.gaierror as e:
        raise ImageFetchError(f"cannot resolve host {host}: {e}")
    for info in infos:
        ip = info[4][0]
        addr = ipaddress.ip_address(ip)
        if (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
            or addr.is_unspecified
        ):
            raise ImageFetchError(f"blocked non-public address {ip} for host {host}")


async def safe_image_fetch(image_url: str) -> Tuple[bytes, str]:
    """Fetch ``image_url`` with SSRF protections and return ``(bytes, content_type)``.

    - only ``http``/``https`` schemes are allowed
    - the host must resolve only to public addresses
    - redirects are *not* followed (a public URL must not bounce to an internal
      one); a 3xx is treated as a failure
    - connect/read timeouts bound the request
    - the response must advertise an ``image/*`` content type and stay within
      the size cap, which is enforced while streaming as well as up front

    :raises ImageFetchError: if the URL is unsafe, too large, or not an image.
    :raises ImageUpstreamError: if the host answered with a non-200 status.
    """
    parsed = urlparse(image_url)
    if parsed.scheme not in ("http", "https"):
        raise ImageFetchError(f"unsupported scheme {parsed.scheme!r}")
    if not parsed.hostname:
        raise ImageFetchError("missing host")

    await _assert_public_host(parsed.hostname)

    client = image_client()
    async with client.stream("GET", image_url) as resp:
        # Treat any redirect as a failure rather than following it: the target
        # could point at an internal address and sidestep _assert_public_host.
        if 300 <= resp.status_code < 400:
            raise ImageFetchError(f"redirects are not allowed (got {resp.status_code})")
        if resp.status_code != 200:
            raise ImageUpstreamError(resp.status_code)

        content_type = resp.headers.get("Content-Type", "")
        if not content_type.lower().startswith("image/"):
            raise ImageFetchError(f"not an image (Content-Type {content_type!r})")

        # Reject oversized images up front when the server advertises a length.
        declared = resp.headers.get("Content-Length")
        if (
            declared is not None
            and declared.isdigit()
            and int(declared) > MAX_IMAGE_BYTES
        ):
            raise ImageFetchError("image exceeds size limit")

        # Read the body with a hard size cap to avoid memory exhaustion.
        chunks = []
        total = 0
        async for chunk in resp.aiter_bytes(8192):
            total += len(chunk)
            if total > MAX_IMAGE_BYTES:
                raise ImageFetchError("image exceeds size limit")
            chunks.append(chunk)

    return b"".join(chunks), content_type


def _thumbnail(content: bytes, image_type: str) -> bytes:
    """Decode ``content`` and shrink it to thumbnail size.

    Decoding and resizing are CPU-bound and can take hundreds of milliseconds on
    a large image, so callers run this with :func:`asyncio.to_thread`.
    """
    img = Image.open(BytesIO(content))
    img.thumbnail((320, 240))
    fake_file = BytesIO()
    img.save(fake_file, image_type)
    return fake_file.getvalue()


@router.api_route("/imageproxy/{image_url:path}", methods=["GET", "POST"])
async def imageproxy(request: Request, image_url: str, response_class=HTMLResponse):
    """
    Proxy and thumbnail an image referenced by student code (Skulpt image
    programs).  The image URL is fully user-controlled, so this endpoint applies
    SSRF protections via :func:`safe_image_fetch` before retrieving anything.

    :param request: The FastAPI request object.
    :type request: Request
    :param response_class: defaults to HTMLResponse
    :type response_class: _type_, optional
    :return: HTMLResponse
    :rtype: HTMLResponse
    """

    rslogger.info(f"Resizing image URL: {image_url}")
    # not sure why or where but the image_url is getting mangled
    if image_url.startswith("https:/") and not image_url.startswith("https://"):
        image_url = image_url.replace("https:/", "https://")
        rslogger.debug(f"NEW Image URL: {image_url}")
    try:
        content, mt = await safe_image_fetch(image_url)
    except ImageFetchError as e:
        rslogger.warning(f"Blocked image proxy for {image_url}: {e}")
        return HTMLResponse(
            content="Cannot Retrieve Image", status_code=400, media_type="text/html"
        )
    except ImageUpstreamError as e:
        # Relay the host's own status; 404 gets its own message as before.
        if e.status_code == 404:
            return HTMLResponse(
                content="Image not found", status_code=404, media_type="text/html"
            )
        return HTMLResponse(
            content="Cannot Retrieve Image",
            status_code=e.status_code,
            media_type="text/html",
        )
    except Exception as e:
        rslogger.error(f"Error getting image: {image_url}: {e}")
        return HTMLResponse(
            content="Cannot Retrieve Image", status_code=404, media_type="text/html"
        )

    try:
        # "image/png; charset=binary" -> "png"
        image_type = mt.split(";")[0].strip().split("/")[1]
        thumbnail = await asyncio.to_thread(_thumbnail, content, image_type)
    except Exception as e:
        rslogger.error(f"Error resizing image: {e}")
        return HTMLResponse(content="Error", status_code=500, media_type="text/html")

    return HTMLResponse(content=thumbnail, status_code=200, media_type=mt)


# Using this function makes the runestone proxy act like a load balancer
# for using more than one jobe server.
#
def get_jobe_server(request: Request) -> str:
    return settings.jobe_server


class RunSpec(BaseModel):
    run_spec: Optional[Dict] = None
    file_contents: Optional[str] = None


@router.api_route("/jobeRun", methods=["POST"])
async def jobeRun(request: Request, request_data: RunSpec, response_class=JSONResponse):
    rslogger.debug("got a jobe request %s", request_data.run_spec)

    uri = "/jobe/index.php/restapi/runs/"
    url = get_jobe_server(request) + uri
    rs = {"run_spec": request_data.run_spec}
    try:
        resp = await jobe_client().post(url, json=rs)
    except httpx.TimeoutException:
        rslogger.error(f"Timed out waiting for jobe at {url}")
        return JSONResponse(
            status_code=504, content={"error": "The code runner timed out."}
        )
    except httpx.HTTPError as e:
        rslogger.error(f"Error talking to jobe at {url}: {e}")
        return JSONResponse(
            status_code=502, content={"error": "The code runner is unavailable."}
        )

    rslogger.debug("Got response from JOBE %s ", resp.status_code)
    rslogger.debug("Got response from JOBE %s ", resp.content)
    try:
        json = resp.json()
    except ValueError:
        rslogger.error(
            f"jobe returned {resp.status_code} with a non-JSON body: {resp.text[:200]!r}"
        )
        return JSONResponse(
            status_code=502, content={"error": "The code runner returned junk."}
        )
    rslogger.debug("Got response from JOBE Run JSON is %s ", json)
    return JSONResponse(status_code=resp.status_code, content=jsonable_encoder(json))


@router.api_route("/jobePushFile/{fhash:str}", methods=["POST", "PUT"])
async def jobePushFile(
    request: Request, fhash: str, request_data: RunSpec, response_class=Response
):
    uri = "/jobe/index.php/restapi/files/" + fhash
    url = get_jobe_server(request) + uri
    rs = {"file_contents": request_data.file_contents}
    try:
        resp = await jobe_client().put(url, json=rs)
    except httpx.TimeoutException:
        rslogger.error(f"Timed out pushing a file to jobe at {url}")
        return Response(status_code=504)
    except httpx.HTTPError as e:
        rslogger.error(f"Error pushing a file to jobe at {url}: {e}")
        return Response(status_code=502)

    rslogger.debug("Got response from JOBE pushFile %s ", resp.status_code)
    # pushing the file does not result in any json in the response.  We just care about
    # the status code, so no body is returned.  In fact returning a body causes an error
    # deep down in the fastapi code.
    return Response(status_code=resp.status_code)


@router.api_route("/jobeCheckFile/{fhash:str}", methods=["HEAD", "GET"])
async def jobeCheckFile(request: Request, fhash: str, response_class=Response):
    rslogger.debug("got a jobe request HEAD jobeCheckFile")

    uri = "/jobe/index.php/restapi/files/" + fhash
    url = get_jobe_server(request) + uri
    try:
        resp = await jobe_client().head(url)
    except httpx.TimeoutException:
        rslogger.error(f"Timed out checking a file on jobe at {url}")
        return Response(status_code=504)
    except httpx.HTTPError as e:
        rslogger.error(f"Error checking a file on jobe at {url}: {e}")
        return Response(status_code=502)

    rslogger.debug("Got response from JOBE checkFile %s ", resp.status_code)

    return Response(status_code=resp.status_code)


class PytutorTrace(BaseModel):
    code: str
    lang: str
    stdin: str = ""


@router.api_route("/pytutor_trace", methods=["POST"])
async def pytutor_trace(
    request: Request, request_data: PytutorTrace, response_class=JSONResponse
):
    code = request_data.code
    lang = request_data.lang
    # response.headers["Content-Type"] = "application/json; charset=utf-8"
    if request_data.stdin:
        stdin = request_data.stdin
    else:
        stdin = ""

    url = f"http://tracer.runestone.academy:5000/trace{lang}"
    try:
        r = await trace_client().post(url, data=dict(src=code, stdin=stdin))
    except httpx.TimeoutException:
        rslogger.error(
            "The request to the trace server timed out, you will need to rerun the build"
        )
        return Response(status_code=500, content="", media_type="application/json")
    except Exception as e:
        rslogger.error(f"Unknown error occurred while getting trace: {e}")
        return Response(
            status_code=500,
            content="Error in pytutor_trace",
            media_type="application/json",
        )
    if r.status_code == 200:
        if lang == "java":
            return Response(
                status_code=200, content=r.text, media_type="application/json"
            )
        else:
            res = r.text[r.text.find('{"code":') :]
            return Response(status_code=200, content=res, media_type="application/json")
    rslogger.error(f"Unknown error occurred while getting trace {r.status_code}")
    return Response(
        status_code=500, content="Error in pytutor_trace", media_type="application/json"
    )
