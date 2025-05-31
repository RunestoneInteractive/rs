import typing as t
import aiohttp

from ...message_launch import MessageLaunch
from ...request import Request
from ...tool_config import ToolConfAbstract
from ...cookie import CookieService
from ...session import SessionService
from ...launch_data_storage.base import LaunchDataStorage

from .cookie import FastAPICookieService
from .session import FastAPISessionService

REQ = t.TypeVar("REQ", bound=Request)
TCONF = t.TypeVar("TCONF", bound=ToolConfAbstract)
SES = t.TypeVar("SES", bound=SessionService)
COOK = t.TypeVar("COOK", bound=CookieService)


class FastAPIMessageLaunch(MessageLaunch):
    def __init__(
        self,
        request: REQ,
        tool_config: TCONF,
        session_service: t.Optional[SES] = None,
        cookie_service: t.Optional[COOK] = None,
        launch_data_storage: t.Optional[LaunchDataStorage[t.Any]] = None,
        requests_session: t.Optional[aiohttp.ClientSession] = None,
    ):
        """
        Do not call this method directly, use `create` instead
        """
        cookie_service = (
            cookie_service if cookie_service else FastAPICookieService(request)
        )
        session_service = (
            session_service if session_service else FastAPISessionService(request)
        )
        super().__init__(
            request,
            tool_config,
            session_service,
            cookie_service,
            launch_data_storage,
            requests_session,
        )


    @classmethod
    async def create(
        cls,
        request: REQ,
        tool_config: TCONF,
        session_service: t.Optional[SES] = None,
        cookie_service: t.Optional[COOK] = None,
        launch_data_storage: t.Optional[LaunchDataStorage[t.Any]] = None,
        requests_session: t.Optional[aiohttp.ClientSession] = None,
    ) -> "FastAPIMessageLaunch":
        obj = cls(
            request,
            tool_config,
            session_service=session_service,
            cookie_service=cookie_service,
            launch_data_storage=launch_data_storage,
            requests_session=requests_session,
        )
        # Disable verification of iat to prevent clock skew problems from invalidating tokens
        obj._jwt_verify_options = {"verify_aud": False, "verify_iat": False}
        
        return await obj.validate()

    def _get_request_param(self, key: str) -> str:
        return self._request.get_param(key)