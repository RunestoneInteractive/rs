from pathlib import Path
from pydantic_settings import BaseSettings


class LocalConfig(BaseSettings):
    # Provide a path to the book server files. The leading underscore prevents environment variables from affecting this value. See the `docs <https://pydantic-docs.helpmanual.io/usage/models/#automatically-excluded-attributes>`_, which don't say this explicitly, but testing confirms it.
    _assignment_server_path: str = str(Path(__file__).parent.absolute())


local_settings = LocalConfig()
