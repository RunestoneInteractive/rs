import aiohttp


class LtiException(Exception):
    pass


class OIDCException(Exception):
    pass


class LtiServiceException(LtiException):
    def __init__(self, response: aiohttp.ClientResponse):
        msg = f"HTTP response [{response.url}]: {str(response.status)} - {response.reason}"
        super().__init__(msg)
        self.response = response
