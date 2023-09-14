from pathlib import Path

import importlib.resources
from pydantic_settings import BaseSettings

#with importlib.resources.path("rsptx.book_server_api", "") as path:
#    bs_path = Path(path)


class LocalConfig(BaseSettings):
    # Provide a path to the book server files. The leading underscore prevents environment variables from affecting this value. See the `docs <https://pydantic-docs.helpmanual.io/usage/models/#automatically-excluded-attributes>`_, which don't say this explicitly, but testing confirms it.
    _book_server_path: str = Path(importlib.resources.files("rsptx.book_server_api").joinpath("")).absolute()

local_settings = LocalConfig()
