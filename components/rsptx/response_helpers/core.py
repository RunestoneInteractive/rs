"""
Response Helpers for FastAPI
============================
"""

#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import datetime
import json
import os
from pathlib import Path
import re
import sys
from typing import Any, List

# Third-party imports
# -------------------
from fastapi import status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

#
# Local application imports
# -------------------------
# None.


# Functions
# =========
def canonicalize_tz(tstring: str) -> str:
    """
    Browsers are not consistent with how they format times with timezones for example
    Safari:  Tue Sep 08 2020 21:13:00 GMT-0500 (CDT)
    Chrome: Tue Sep 08 2020 21:13:00 GMT-0500 (Central Daylight Time)
    This function tries to coerce the time string into the Safari format as it
    is more compatible with other time/date functions
    """
    x = re.search(r"\((.*)\)", tstring)
    if x:
        z = x.group(1)
        y = z.split()
        if len(y) == 1:
            return tstring
        else:
            zstring = "".join([i[0] for i in y])
            return re.sub(r"(.*)\((.*)\)", r"\1({})".format(zstring), tstring)
    return tstring


def make_json_response(
    status: int = status.HTTP_200_OK, detail: Any = None
) -> JSONResponse:
    """Format a proper JSON response for the API.

    :param status: status code of the response, defaults to status.HTTP_200_OK
    :type status: int, optional
    :param detail: detailed values for the response.  Note that the contents of the detail are api independent, but the goal is for all API calls to use this format., defaults to None
    :type detail: Any, optional
    :return: Return the JSON response object that FastAPI expects.
    :rtype: JSONResponse
    """
    # content is a required parameter for a JSONResponse
    return JSONResponse(
        status_code=status, content=jsonable_encoder({"detail": detail})
    )


def http_422error_detail(
    # Should be a list, the first element indicates where the error occurred for example in the path or in the body of the request. it could also be function I suppose. The second element in the list gives the name of the data element that is not valid.
    loc: List[str],
    # a descriptive message about the error.
    msg: str,
    # this is the specific error that was raised. e.g. value_error, type_error, integrity_error.
    err_type: str,
) -> List[dict]:
    """The 422 indicates that the request was not formatted correctly.  This function provides
    the details on what was missing.  Based on information we get from Pydantic.

    :param loc: the location of the error in the request
    :type loc: List[str]
    :param msg: A descriptive message about the error.
    :type msg: str
    :param err_type: the specific error that was raised. e.g. value_error, type_error, integrity_error.
    :type err_type: str
    :return: A list of dictionaries that can be used to construct the detail for the response.
    :rtype: List[dict]
    """
    return [{"loc": loc, "msg": msg, "type": err_type}]


def get_webpack_static_imports(course):
    # Import webpack CSS and JS.
    with open(
        Path(
            os.environ["BOOK_PATH"],
            course.base_course,
            "published",
            course.base_course,
            "_static/webpack_static_imports.json",
        ),
        encoding="utf-8",
    ) as f:
        wp_imports = json.load(f)

    return wp_imports


# the parts of the manifest file that are interesting for us are:
# {
#   "index.html": {
#     "file": "assets/index-BdZ5doun.js",
#     "src": "index.html",
#     "isEntry": true,
#     "dynamicImports": [
#       "node_modules/web-vitals/dist/web-vitals.js"
#     ],
#     "css": [
#       "assets/index-Bz00Bcvm.css"
#     ],
# ... }


def get_react_imports(reactdir):
    # Import webpack CSS and JS.
    with open(
        Path(
            reactdir,
            ".vite",
            "manifest.json",
        ),
        encoding="utf-8",
    ) as f:
        react_imports = json.load(f)

    indexfile = react_imports["index.html"]["file"]
    cssfiles = react_imports["index.html"]["css"]
    react_imports["js"] = [indexfile]
    react_imports["css"] = cssfiles

    return react_imports


def canonical_utcnow():
    """
    Return a datetime object that is the current time in UTC without timezone information.
    """
    if sys.version_info.minor >= 11:
        return datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
    else:
        return datetime.datetime.utcnow()
