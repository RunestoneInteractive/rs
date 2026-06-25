# ***********************************
# |docname| - Provide code advice
# ***********************************
# Endpoints to provide various kinds of advice (syntax/style/etc...)
# about code samples
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import ipaddress
import socket
from typing import Dict, Optional
from urllib.parse import urlparse
from PIL import Image
from io import BytesIO

# Third-party imports
# -------------------
from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
import requests as rq

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


def _assert_public_host(host: str) -> None:
    """Resolve ``host`` and raise :class:`ImageFetchError` if any resolved
    address is private, loopback, link-local, reserved, multicast, or
    unspecified.  This is the core SSRF guard: it blocks the cloud metadata
    endpoint (169.254.169.254) and anything inside our own network.
    """
    try:
        infos = socket.getaddrinfo(host, None)
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


def safe_image_fetch(image_url: str) -> rq.Response:
    """Fetch ``image_url`` with SSRF protections, returning the streamed
    :class:`requests.Response`.

    - only ``http``/``https`` schemes are allowed
    - the host must resolve only to public addresses
    - redirects are *not* followed (a public URL must not bounce to an internal
      one); a 3xx is treated as a failure
    - connect/read timeouts bound the request
    - the response must advertise an ``image/*`` content type and stay within
      the size cap

    The caller is responsible for closing the returned response.
    """
    parsed = urlparse(image_url)
    if parsed.scheme not in ("http", "https"):
        raise ImageFetchError(f"unsupported scheme {parsed.scheme!r}")
    if not parsed.hostname:
        raise ImageFetchError("missing host")

    _assert_public_host(parsed.hostname)

    resp = rq.get(image_url, timeout=(5, 10), stream=True, allow_redirects=False)

    # Treat any redirect as a failure rather than following it: the target
    # could point at an internal address and sidestep _assert_public_host.
    if resp.is_redirect or resp.is_permanent_redirect:
        resp.close()
        raise ImageFetchError(f"redirects are not allowed (got {resp.status_code})")

    content_type = resp.headers.get("Content-Type", "")
    if not content_type.lower().startswith("image/"):
        resp.close()
        raise ImageFetchError(f"not an image (Content-Type {content_type!r})")

    # Reject oversized images up front when the server advertises a length.
    declared = resp.headers.get("Content-Length")
    if declared is not None and declared.isdigit() and int(declared) > MAX_IMAGE_BYTES:
        resp.close()
        raise ImageFetchError("image exceeds size limit")

    return resp


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
        response = safe_image_fetch(image_url)
    except ImageFetchError as e:
        rslogger.warning(f"Blocked image proxy for {image_url}: {e}")
        return HTMLResponse(
            content="Cannot Retrieve Image", status_code=400, media_type="text/html"
        )
    except Exception:
        rslogger.error(f"Error getting image: {image_url}")
        return HTMLResponse(
            content="Cannot Retrieve Image", status_code=404, media_type="text/html"
        )
    try:
        if response.status_code == 200:
            mt = response.headers["Content-Type"]
            image_type = mt.split("/")[1]
            # Read the body with a hard size cap to avoid memory exhaustion.
            content = b""
            for chunk in response.iter_content(8192):
                content += chunk
                if len(content) > MAX_IMAGE_BYTES:
                    response.close()
                    return HTMLResponse(
                        content="Image too large",
                        status_code=413,
                        media_type="text/html",
                    )
            response.close()
            img = Image.open(BytesIO(content))
            img.thumbnail((320, 240))
            fake_file = BytesIO()
            img.save(fake_file, image_type)
            return HTMLResponse(
                content=fake_file.getvalue(),
                status_code=200,
                media_type=mt,
            )
        elif response.status_code == 404:
            response.close()
            return HTMLResponse(
                content="Image not found", status_code=404, media_type="text/html"
            )
        else:
            status_code = response.status_code
            response.close()
            return HTMLResponse(
                content="Cannot Retrieve Image",
                status_code=status_code,
                media_type="text/html",
            )
    except Exception as e:
        rslogger.error(f"Error resizing image: {e}")
        return HTMLResponse(content="Error", status_code=500, media_type="text/html")


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
    req = rq.Session()
    rslogger.debug("got a jobe request %s", request_data.run_spec)

    req.headers["Content-type"] = "application/json; charset=utf-8"
    req.headers["Accept"] = "application/json"
    if settings.jobe_key:
        req.headers["X-API-KEY"] = settings.jobe_key

    uri = "/jobe/index.php/restapi/runs/"
    url = get_jobe_server(request) + uri
    rs = {"run_spec": request_data.run_spec}
    resp = req.post(url, json=rs)

    rslogger.debug("Got response from JOBE %s ", resp.status_code)
    rslogger.debug("Got response from JOBE %s ", resp.content)
    json = resp.json()
    rslogger.debug("Got response from JOBE Run JSON is %s ", json)
    return JSONResponse(
        status_code=resp.status_code, content=jsonable_encoder(resp.json())
    )


@router.api_route("/jobePushFile/{fhash:str}", methods=["POST", "PUT"])
async def jobePushFile(
    request: Request, fhash: str, request_data: RunSpec, response_class=Response
):
    req = rq.Session()

    req.headers["Content-type"] = "application/json; charset=utf-8"
    req.headers["Accept"] = "application/json"
    req.headers["X-API-KEY"] = settings.jobe_key

    uri = "/jobe/index.php/restapi/files/" + fhash
    url = get_jobe_server(request) + uri
    rs = {"file_contents": request_data.file_contents}
    resp = req.put(url, json=rs)

    rslogger.debug("Got response from JOBE pushFile %s ", resp.status_code)
    rslogger.debug("type of status code %s", type(resp.status_code))
    # pushing the file does not result in any json in the response.  We just care about
    # the status code, so no body is returned.  In fact returning a body causes an error
    # deep down in the fastapi code.
    return Response(status_code=resp.status_code)


@router.api_route("/jobeCheckFile/{fhash:str}", methods=["HEAD", "GET"])
async def jobeCheckFile(request: Request, fhash: str, response_class=Response):
    req = rq.Session()
    rslogger.debug("got a jobe request HEAD jobeCheckFile")

    req.headers["Content-type"] = "application/json; charset=utf-8"
    req.headers["Accept"] = "application/json"
    req.headers["X-API-KEY"] = settings.jobe_key
    uri = "/jobe/index.php/restapi/files/" + fhash
    url = get_jobe_server(request) + uri
    resp = req.head(url)
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
        r = rq.post(url, data=dict(src=code, stdin=stdin), timeout=30)
    except rq.ReadTimeout:
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
