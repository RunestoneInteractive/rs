# *******************************************
# |docname| - Form data echo (CGI "Dump" clone)
# *******************************************
# This module reimplements the classic ``dumper.pl`` CGI teaching script: a page
# that echoes back the parameters of whatever form was submitted to it, plus a
# little information about the request itself.  It is used in web programming
# lessons so students can see exactly what their ``<form>`` sent.
#
# Because this endpoint reflects user supplied text back to the browser it is
# deliberately paranoid:
#
# * every value that ends up in the page is HTML escaped -- the page is built
#   here rather than in a template so there is no ``| safe`` to get wrong;
# * the request body is read with a hard size cap, and the number/length of the
#   fields that get displayed is capped as well;
# * the response is served with ``Content-Security-Policy: ... sandbox`` so the
#   page is inert even if an escaping bug ever slipped through;
# * only GET and POST are accepted and nothing is written to the database.
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import html
import ipaddress
from datetime import datetime
from typing import List, Tuple
from urllib.parse import parse_qsl

# Third-party imports
# -------------------
from fastapi import APIRouter, Request, status
from fastapi.responses import HTMLResponse
from starlette.datastructures import UploadFile

# Local application imports
# -------------------------
from rsptx.logging import rslogger

# Routing
# =======
router = APIRouter(
    tags=["echoform"],
)

# Limits
# ------
# The largest request body we are willing to read.  Anything bigger gets a 413
# instead of being buffered in memory.
MAX_BODY_BYTES = 256 * 1024
# Caps on what we will render.  A form that exceeds these is still accepted; the
# extra fields/characters are simply reported as truncated.
MAX_FIELDS = 200
MAX_VALUES_PER_FIELD = 50
MAX_NAME_CHARS = 200
MAX_VALUE_CHARS = 4096

# Make the page inert: no scripts, styles, images or navigation of any kind, and
# it may not be framed.  ``sandbox`` (with no tokens) is the strongest form.
SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'none'; base-uri 'none'; form-action 'none'; "
        "frame-ancestors 'none'; sandbox"
    ),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}


def _esc(text: str) -> str:
    """HTML escape a string, quotes included."""
    return html.escape(text, quote=True)


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + " ...[truncated]"


class _TooLarge(Exception):
    """The request body exceeded ``MAX_BODY_BYTES``."""


def _remote_host(request: Request) -> str:
    """The client address, equivalent to CGI's ``remote_host()``.

    Caddy/nginx append the peer address to ``X-Forwarded-For``, so the *last*
    entry is the address our proxy actually saw; earlier entries may have been
    forged by the client.  The value is only used if it parses as an IP address
    so that we never echo back arbitrary header text.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        candidate = forwarded.split(",")[-1].strip()
        try:
            return str(ipaddress.ip_address(candidate))
        except ValueError:
            rslogger.debug(
                f"echoform: ignoring unparsable X-Forwarded-For {forwarded!r}"
            )
    return request.client.host if request.client else "unknown"


async def _read_capped_body(request: Request) -> bytes:
    """Read the request body, refusing to buffer more than ``MAX_BODY_BYTES``.

    ``Content-Length`` is checked first so oversized uploads are rejected up
    front, but the streaming loop is what actually enforces the cap (a chunked
    request has no ``Content-Length`` to check).
    """
    declared = request.headers.get("content-length")
    if declared is not None:
        try:
            declared_len = int(declared)
        except ValueError:
            declared_len = None
        if declared_len is not None and declared_len > MAX_BODY_BYTES:
            raise _TooLarge()

    chunks: List[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_BODY_BYTES:
            raise _TooLarge()
        chunks.append(chunk)
    body = b"".join(chunks)
    # Cache the body so a later ``request.form()`` can re-read it instead of
    # trying (and failing) to consume the already-drained stream.
    request._body = body
    return body


async def _collect_params(request: Request) -> List[Tuple[str, List[str]]]:
    """Gather the submitted parameters as an ordered list of (name, values).

    Like CGI.pm, body parameters come first and the query string is merged in
    after, with repeated names grouped under a single entry.
    """
    items: List[Tuple[str, str]] = []

    if request.method == "POST":
        body = await _read_capped_body(request)
        content_type = request.headers.get("content-type", "")
        media_type = content_type.split(";")[0].strip().lower()
        if media_type == "multipart/form-data":
            form = await request.form(
                max_files=MAX_FIELDS,
                max_fields=MAX_FIELDS,
                max_part_size=MAX_BODY_BYTES,
            )
            try:
                for name, value in form.multi_items():
                    if isinstance(value, UploadFile):
                        items.append(
                            (
                                name,
                                f"(file upload: {value.filename or 'unnamed'}, "
                                f"{value.content_type or 'unknown type'}, "
                                f"{value.size if value.size is not None else '?'} bytes)",
                            )
                        )
                    else:
                        items.append((name, value))
            finally:
                await form.close()
        elif media_type == "application/x-www-form-urlencoded" or (
            media_type == "" and body
        ):
            items.extend(
                parse_qsl(
                    body.decode("utf-8", errors="replace"), keep_blank_values=True
                )
            )
        # Any other content type (JSON, plain text, ...) has no CGI-style
        # parameters; the query string below is all we report.

    items.extend(request.query_params.multi_items())

    grouped: List[Tuple[str, List[str]]] = []
    index = {}
    for name, value in items:
        if name not in index:
            index[name] = len(grouped)
            grouped.append((name, []))
        grouped[index[name]][1].append(value)
    return grouped


def _dump_html(params: List[Tuple[str, List[str]]]) -> str:
    """Render the parameters the way ``CGI::Dump`` does: a nested list."""
    if not params:
        return "<ul></ul>"

    lines = ["<ul>"]
    for name, values in params[:MAX_FIELDS]:
        lines.append(
            f"<li><strong>{_esc(_truncate(name, MAX_NAME_CHARS))}</strong></li>"
        )
        lines.append("<ul>")
        for value in values[:MAX_VALUES_PER_FIELD]:
            # Escape first, then turn the (now harmless) newlines into breaks.
            shown = _esc(_truncate(value, MAX_VALUE_CHARS)).replace("\n", "<br />\n")
            lines.append(f"<li>{shown}</li>")
        if len(values) > MAX_VALUES_PER_FIELD:
            lines.append(
                f"<li><em>...{len(values) - MAX_VALUES_PER_FIELD} more values "
                f"not shown</em></li>"
            )
        lines.append("</ul>")
    if len(params) > MAX_FIELDS:
        lines.append(
            f"<li><em>...{len(params) - MAX_FIELDS} more fields not shown</em></li>"
        )
    lines.append("</ul>")
    return "\n".join(lines)


# echoform
# --------
# Accepts a form submitted by either method and echoes it back.
@router.get("/echoform", response_class=HTMLResponse)
@router.post("/echoform", response_class=HTMLResponse)
async def echoform(request: Request) -> HTMLResponse:
    try:
        params = await _collect_params(request)
    except _TooLarge:
        return HTMLResponse(
            '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
            '<title>Your Form Data</title></head><body bgcolor="white">\n'
            "<h1>Your Form Data</h1>\n"
            f"<p>That submission was too large. This page accepts at most "
            f"{MAX_BODY_BYTES // 1024} KB of form data.</p>\n"
            "</body></html>\n",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            headers=SECURITY_HEADERS,
        )

    now = datetime.now()
    # Deliberately unpadded, matching the original script's
    # "$year/$mon/$mday $hour:$min:$sec".
    local_time = (
        f"{now.year}/{now.month}/{now.day} {now.hour}:{now.minute}:{now.second}"
    )

    referer = request.headers.get("referer") or "(none)"
    server_name = request.url.hostname or request.headers.get("host") or "(unknown)"

    body = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Your Form Data</title></head>
<body bgcolor="white">
<h1>Your Form Data</h1>
<p>Your form was submitted from {_esc(_remote_host(request))}</p>
<p>It was referred by {_esc(referer)}</p>
<p>It arrived at {_esc(server_name)}</p>
<p>at local time {_esc(local_time)}</p>
<p>Your form was submitted using the {_esc(request.method)} method.</p>
<p>It had these inputs and values:</p>
{_dump_html(params)}
</body>
</html>
"""
    return HTMLResponse(body, headers=SECURITY_HEADERS)
