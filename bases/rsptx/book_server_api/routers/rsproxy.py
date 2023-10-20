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
from PIL import Image
from io import BytesIO

# Third-party imports
# -------------------
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
import requests

# Local application imports
# -------------------------
from rsptx.logging import rslogger

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
        response = requests.get(image_url)
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
