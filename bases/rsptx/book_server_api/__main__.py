# *****************************************************
# |docname| - Provide a simple method to run the server
# *****************************************************
# From the terminal / command line, execute either ``bookserver`` or ``python -m bookserver``, which runs the book server.
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import os
from pathlib import Path
import subprocess
import sys
from pkg_resources import require

# Third-party imports
# -------------------
import click

# Local application imports
# -------------------------
# None.


# Code
# ====
@click.command()
@click.option(
    "--runestone-path",
    default=os.environ.get("RUNESTONE_PATH", None),
    help="path to web2py install",
)
@click.option(
    "--gconfig", default="./gunicorn.config.py", help="path to gunicorn config file"
)
@click.option("--book_path", default=None, help="Path to folder of books")
@click.option("--error_path", default=None, help="Path to folder to dump tracebacks")
@click.option(
    "--bks_config",
    default=os.environ.get("BOOK_SERVER_CONFIG", "development"),
    help="bookserver mode (test, development, production)",
)
@click.option("--dburl", default=None, help="Database URL to use regardless of mode")
@click.option("--reload", is_flag=True, help="reload when code changes")
@click.option(
    "--root", default=None, help="Set the root path for uvicorn when behind a proxy"
)
@click.option(
    "--bind", default="localhost:8080", help="Where to listen or socket to bind"
)
@click.option("--verbose", is_flag=True, help="Print out config information")
@click.option("--version", is_flag=True, help="Print out version and exit")
def run(
    runestone_path: str,
    gconfig: str,
    book_path: str,
    error_path: str,
    bks_config: str,
    dburl: str,
    reload: bool,
    root: str,
    bind: str,
    verbose: bool,
    version: bool,
):
    is_win = sys.platform == "win32"

    if version:
        vname = require("bookserver")[0].version
        print("BookServer Version {}".format(vname))
        sys.exit()

    if runestone_path and not Path(runestone_path).exists():
        click.echo(f"Warning: runestone_path {runestone_path} does not exist")
    elif not runestone_path:
        click.echo("Warning: runestone_path is not defined.")

    if verbose:
        click.echo(f"{runestone_path=}")
        click.echo(f"{sys.executable=}")

    # set of verify will upcase the names
    set_or_verify_env("runestone_path", runestone_path)
    set_or_verify_env("root_path", root)
    set_or_verify_env("book_path", book_path)
    set_or_verify_env("error_path", error_path)
    set_or_verify_env("book_server_config", bks_config)
    set_or_verify_dburl(bks_config, dburl)

    # gunicorn doesn't `run on Windows <https://github.com/benoitc/gunicorn/issues/524>`_.
    if is_win:
        args = [
            sys.executable,
            "-m",
            "uvicorn",
            # See the `uvicorn command-line docs <https://www.uvicorn.org/#command-line-options>`_.
            "--port",
            "8080",
            "bookserver.main:app",
        ]
    else:
        args = [
            sys.executable,
            "-m",
            # See the `gunicorn command-line docs <https://docs.gunicorn.org/en/latest/run.html#commonly-used-arguments>`_.
            "gunicorn",
            # `-c <https://docs.gunicorn.org/en/stable/settings.html#config>`_: The Gunicorn config file.
            "--config",
            f"{gconfig}",
            # Where to serve or bind to socket for production
            f"--bind={bind}",
        ]
        if reload:
            args.append("--reload")
    # Suppress a traceback on a keyboard interrupt.
    try:
        return subprocess.run(args).returncode
    except KeyboardInterrupt:
        return 1


def set_or_verify_dburl(mode: str, value: str):
    """
    if bookserver is given a --dburl parameter then set the environment
    variable for appropriate mode. The environment variable value will be
    inherited by all subprocesses.
    """
    if mode == "production":
        if value:
            os.environ["DBURL"] = value
        else:
            click.echo(
                "Using the value from the existing environment variable DBURL (which is omitted for security reasons)."
            )
    elif mode == "development":
        if value:
            os.environ["DEV_DBURL"] = value
        else:
            click.echo(f"{os.environ['DEV_DBURL']=}")
    elif mode == "test":
        if value:
            os.environ["TEST_DBURL"] = value
        else:
            click.echo(f"{os.environ['TEST_DBURL']=}")
    else:
        click.echo("ERROR book_server_config must be production, development, or test!")


def set_or_verify_env(name, value, verbose=False):
    name = name.upper()
    if name in os.environ and value:
        if verbose:
            click.echo(f"Updating {name} to {value}")
        os.environ[name] = value
    if value and name not in os.environ:
        if verbose:
            click.echo(f"Setting {name} to {value}")
        os.environ[name] = value
    if not value and verbose:
        click.echo(f"Using {os.environ[name]=}")


if __name__ == "__main__":
    sys.exit(run())
