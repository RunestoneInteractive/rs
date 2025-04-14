import typing as t
from fastapi.responses import Response

from ...request import Request
from ...tool_config import ToolConfAbstract
from ...cookie import CookieService
from ...session import SessionService
from ...launch_data_storage.base import LaunchDataStorage
from ...oidc_login import OIDCLogin

from .cookie import FastAPICookieService
from .session import FastAPISessionService
from .redirect import FastAPIRedirect

RED = t.TypeVar("RED")
REQ = t.TypeVar("REQ", bound=Request)
TCONF = t.TypeVar("TCONF", bound=ToolConfAbstract)
SES = t.TypeVar("SES", bound=SessionService)
COOK = t.TypeVar("COOK", bound=CookieService)

class FastAPIOIDCLogin(OIDCLogin):
    def __init__(
        self,
        request: REQ,
        tool_config: TCONF,
        session_service: SES = None,
        cookie_service: COOK = None,
        launch_data_storage: t.Optional[LaunchDataStorage[t.Any]] = None,
    ):
        cookie_service = (
            cookie_service if cookie_service else FastAPICookieService(request)
        )
        session_service = (
            session_service if session_service else FastAPISessionService(request)
        )
        super().__init__(
            request, tool_config, session_service, cookie_service, launch_data_storage
        )

    def get_redirect(self, url: str) -> FastAPIRedirect:
        return FastAPIRedirect(url, self._cookie_service)

    def get_response(self, html: str) -> Response:
        return Response(html)


