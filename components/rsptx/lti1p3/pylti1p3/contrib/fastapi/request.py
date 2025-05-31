import typing as t

from ...request import Request
from ...tool_config import ToolConfAbstract
from ...cookie import CookieService
from ...session import SessionService
from ...request import Request

from fastapi import Request as FAPI_Request

RED = t.TypeVar("RED")
REQ = t.TypeVar("REQ", bound=Request)
FAPIREQ = t.TypeVar("FAPIREQ", bound=FAPI_Request)
TCONF = t.TypeVar("TCONF", bound=ToolConfAbstract)
SES = t.TypeVar("SES", bound=SessionService)
COOK = t.TypeVar("COOK", bound=CookieService)
LTIFAPIREQ = t.TypeVar("LTIFAPIREQ", bound="FastAPIRequest")


class FastAPIRequest(Request):
    """
    Takes a FastAPI request object (FAPI_Request), and produces a FastAPIRequest
    which wraps a pylti1p3 Request object.
    """

    _cookies: t.Optional[COOK] = None
    _request_data: t.Optional[dict] = None
    _request_is_secure: t.Optional[bool] = None
    _session: t.Optional[SES] = None
    _request: t.Optional[FAPIREQ] = None
    _form: t.Optional[dict] = None

    @classmethod
    async def create(
        cls: t.Type[LTIFAPIREQ],
        request_obj: FAPI_Request,
        cookies: t.Optional[COOK] = None,
        session: t.Optional[SES] = None,
        request_data: t.Optional[dict] = None,
        request_is_secure: t.Optional[bool] = None,
    ) -> LTIFAPIREQ:
        req = cls(
            request_obj,
            cookies=cookies,
            session=session,
            request_data=request_data,
            request_is_secure=request_is_secure
        )
        req._form = await request_obj.form()
        return req

    def __init__(
        self,
        request_obj: FAPI_Request,
        cookies: t.Optional[COOK] = None,
        session: t.Optional[SES] = None,
        request_data: t.Optional[dict] = None,
        request_is_secure: t.Optional[bool] = None,
    ):
        """
        Avoid using this constructor directly, use the create method instead.
        """
        super().__init__()
        self._request = request_obj
        self._cookies = request_obj.cookies if cookies is None else cookies
        self._session = request_obj.session if session is None else session

        is_https = request_obj.url.scheme.lower() == "https"
        self._request_is_secure = (
            is_https if request_is_secure is None else request_is_secure
        )

        if request_data:
            self._request_data = request_data

    @property
    def session(self) -> SES:
        return self._session

    def get_param(self, key) -> t.Union[str, int]:
        if self._request_data:
            return self._request_data.get(key)
        params = None
        if self._request.method == "GET":
            params = self._request.query_params.getlist(key)
        else:
            params = self._form.getlist(key)
        
        if len(params) > 1:
            return params
        if len(params) == 1:
            return params[0] if params else None

    def get_cookie(self, key: str):
        value = self._cookies.get(key)
        return value

    def is_secure(self) -> bool:
        return self._request_is_secure
