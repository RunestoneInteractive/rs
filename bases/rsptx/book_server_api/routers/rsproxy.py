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
from typing import Dict, Optional
from PIL import Image
from io import BytesIO

# Third-party imports
# -------------------
from fastapi import APIRouter, Request, Depends, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
import requests as rq

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from rsptx.configuration.core import settings
from rsptx.auth.session import auth_manager, is_instructor

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


@router.api_route("/imageproxy/{image_url:path}", methods=["GET", "POST"])
async def imageproxy(request: Request, image_url: str, response_class=HTMLResponse):
    """
    Create the library page from the Library database table.

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
        response = rq.get(image_url)
    except Exception:
        rslogger.error(f"Error getting image: {image_url}")
        return HTMLResponse(
            content="Cannot Retrieve Image", status_code=404, media_type="text/html"
        )
    try:
        if response.status_code == 200:
            if "Content-type" in response.headers:
                image_type = response.headers["Content-Type"].split("/")[1]
                mt = response.headers["Content-Type"]
            else:
                image_type = image_url.split(".")[-1]
                if image_type == "jpg":
                    image_type = "jpeg"
                mt = f"image/{image_type}"
            img = Image.open(BytesIO(response.content))
            img.thumbnail((320, 240))
            fake_file = BytesIO()
            img.save(fake_file, image_type)
            return HTMLResponse(
                content=fake_file.getvalue(),
                status_code=200,
                media_type=mt,
            )
        elif response.status_code == 404:
            return HTMLResponse(
                content="Image not found", status_code=404, media_type="text/html"
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

    return JSONResponse(
        status_code=resp.status_code, content=jsonable_encoder(resp.json())
    )


@router.api_route("/jobePushFile/{fhash:str}", methods=["POST", "PUT"])
async def jobePushFile(
    request: Request, fhash: str, request_data: RunSpec, response_class=JSONResponse
):
    req = rq.Session()
    rslogger.debug("got a jobe request %s", request_data.run_spec)

    req.headers["Content-type"] = "application/json; charset=utf-8"
    req.headers["Accept"] = "application/json"
    req.headers["X-API-KEY"] = settings.jobe_key

    uri = "/jobe/index.php/restapi/files/" + fhash
    url = get_jobe_server(request) + uri
    rs = {"file_contents": request_data.file_contents}
    resp = req.put(url, json=rs)

    rslogger.debug("Got response from JOBE %s ", resp.status_code)
    return JSONResponse(
        status_code=resp.status_code, content=jsonable_encoder(resp.json())
    )


@router.api_route("/jobeCheckFile/{fhash:str}", methods=["POST", "HEAD", "GET", "PUT"])
async def jobeCheckFile(request: Request, fhash: str, response_class=JSONResponse):
    req = rq.Session()
    rslogger.debug("got a jobe request HEAD jobeCheckFile")

    req.headers["Content-type"] = "application/json; charset=utf-8"
    req.headers["Accept"] = "application/json"
    req.headers["X-API-KEY"] = settings.jobe_key
    uri = "/jobe/index.php/restapi/files/" + fhash
    url = get_jobe_server(request) + uri
    resp = req.head(url)
    rslogger.debug("Got response from JOBE %s ", resp.status_code)

    return JSONResponse(status_code=resp.status_code, content=jsonable_encoder(""))


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
        stdin = request.vars.stdin
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
