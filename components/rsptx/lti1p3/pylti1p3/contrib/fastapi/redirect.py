import typing as t
from fastapi import Response
from fastapi.responses import RedirectResponse

from ...redirect import Redirect

from .cookie import CookieService


class FastAPIRedirect(Redirect):
    _location: t.Optional[str] = None
    _cookie_service: t.Optional[CookieService] = None

    def __init__(self, location, cookie_service=None):
        super().__init__()
        self._location = location
        self._cookie_service = cookie_service

    def do_redirect(self) -> Response:
        return self._process_response(RedirectResponse(self._location))

    def do_js_redirect(self) -> Response:
        return self._process_response(
            Response(
                f'<script type="text/javascript">window.location="{self._location}";</script>'
            )
        )

    def set_redirect_url(self, location: str):
        self._location = location

    def get_redirect_url(self) -> str:
        return self._location

    def _process_response(self, response: Response) -> Response:
        if self._cookie_service:
            self._cookie_service.update_response(response)
        return response
