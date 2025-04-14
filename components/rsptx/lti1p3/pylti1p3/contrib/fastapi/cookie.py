import typing as t
from fastapi import Request as FAPI_Request
from fastapi import Response as FAPI_Response

from ...cookie import CookieService

class FastAPICookieService(CookieService):
    _request = None
    _cookie_data_to_set = None
    _force_secure = None

    def __init__(self, request: FAPI_Request, force_secure: bool = True):
        self._request = request
        self._cookie_data_to_set = {}
        self._force_secure = force_secure

    def _get_key(self, key: str) -> str:
        return self._cookie_prefix + "-" + key

    def get_cookie(self, name: str) -> t.Union[str, int]:
        return self._request._cookies.get(self._get_key(name))

    def set_cookie(
        self, name: str, value: t.Union[str, int], exp: t.Optional[int] = 3600
    ):
        self._cookie_data_to_set[self._get_key(name)] = {"value": value, "exp": exp}

    def update_response(self, response: FAPI_Response):
        for key, cookie_data in self._cookie_data_to_set.items():
            # need force_secure if request has been passed through proxy 
            is_secure = self._force_secure or self._request.is_secure()
            samesite = "None" if is_secure else None
            response.set_cookie(
                key=key,
                value=cookie_data["value"],
                max_age=cookie_data["exp"],
                expires=None,
                path="/",
                secure=is_secure,
                httponly=True,
                samesite=samesite,
            )
