#!/usr/bin/env python3
#
# `build.py` - Build the wheels and Docker containers needed for this application
# ===============================================================================
#
# Imports
# -------
import asyncio
import io
import locale
import os
import subprocess
import sys
from shutil import copyfile
from typing import Any

# use python-dotenv >= 0.21.0
from dotenv import load_dotenv
from rich.console import Console
from rich.live import Live
from rich.table import Table
from rsptx.cl_utils.core import pushd

# Check environment variables
# ---------------------------
print("Checking your environment")
if not os.path.exists(".env"):
    print("No .env file found.  Please copy sample.env to .env and edit it.")
    exit(1)

if "--verbose" in sys.argv:
    VERBOSE = True
else:
    VERBOSE = False

# Per the [docs](https://pypi.org/project/python-dotenv/), load `.env` into environment variables.
load_dotenv()
console = Console()
table = Table(title="Environment Variables")
table.add_column("Variable", justify="right", style="cyan", no_wrap=True)
table.add_column("Set", style="magenta")
finish = False
for var in [
    "RUNESTONE_PATH",
    "RUNESTONE_HOST",
    "SERVER_CONFIG",
    "BOOK_PATH",
    "WEB2PY_CONFIG",
    "JWT_SECRET",
    "WEB2PY_PRIVATE_KEY",
]:
    if var not in os.environ:
        table.add_row(var, "[red]No[/red]")
        finish = True
    else:
        table.add_row(var, "[green]Yes[/green]")

console.print(table)

if "DC_DBURL" not in os.environ:
    print("DC_DBURL not set.  It will default to DBURL, but you should set it in .env")
    if "DBURL" not in os.environ:
        print("DBURL not set.  Please set it in .env")
        finish = True
else:
    print("DC_DBURL set.  Using it instead of DBURL")


if "DC_DEV_DBURL" not in os.environ:
    print(
        "DC_DEV_DBURL not set.  It will default to DEV_DBURL, but you should set it in .env"
    )
    if "DEV_DBURL" not in os.environ:
        print("DEV_DBURL not set.  Please set it in .env")
        finish = True
else:
    print("DC_DEV_DBURL set.  Using it instead of DEV_DBURL")

if not os.path.isfile("bases/rsptx/web2py_server/applications/runestone/models/1.py"):
    print("Copying 1.py.prototype to 1.py")
    copyfile(
        "bases/rsptx/web2py_server/applications/runestone/models/1.py.prototype",
        "bases/rsptx/web2py_server/applications/runestone/models/1.py",
    )

if finish:
    print(
        "Your environment is not set up correctly.  Please define the environment variables listed above."
    )
    exit(1)

# Attempt to determine the encoding of data returned from stdout/stderr of subprocesses. This is non-trivial. See the discussion at [Python's sys.stdout](https://docs.python.org/3/library/sys.html#sys.stdout). First, try `locale.getencoding()` (requires >= 3.11), with a fallback to `locale.getpreferredencoding()`.
#
# This is motivated by errors on Windows under Python 3.10:
#
#       Traceback (most recent call last):
#       File "C:\Users\bjones\Documents\git\rs\build.py", line 94, in <module>
#           f.write(res.stdout.decode("utf-8"))
#       File "C:\Users\bjones\AppData\Local\Programs\Python\Python310\lib\encodings\cp1252.py", line 19, in encode
#           return codecs.charmap_encode(input,self.errors,encoding_table)[0]
#       UnicodeEncodeError: 'charmap' codec can't encode characters in position 55319-55358: character maps to <undefined>
try:
    # Since this isn't defined on all Python versions, tell mypy to ignore the following error.
    stdout_err_encoding = locale.getencoding()  # type: ignore[attr-defined]
except AttributeError:
    stdout_err_encoding = locale.getpreferredencoding()


# Build wheels
# ------------
table = Table(title="Build Wheels")
table.add_column("Project", justify="right", style="cyan", no_wrap=True)
table.add_column("Built", style="magenta")
with Live(table, refresh_per_second=4):
    for proj in os.listdir("projects"):
        if os.path.isdir(f"projects/{proj}"):
            with pushd(f"projects/{proj}"):
                if os.path.isfile("pyproject.toml"):
                    res = subprocess.run(
                        ["poetry", "build-project"], capture_output=True
                    )
                    if res.returncode == 0:
                        table.add_row(proj, "[green]Yes[/green]")
                    else:
                        table.add_row(proj, "[red]No[/red]")
                        if VERBOSE:
                            print(res.stderr.decode(stdout_err_encoding))
                        else:
                            with open("build.log", "a") as f:
                                f.write(res.stderr.decode(stdout_err_encoding))


# Build Docker containers
# -----------------------
# The following code is based on a post on [SO](https://stackoverflow.com/a/66400096/16038919).
## {
# Given an input and output(s), copy from one to the other(s).
async def output_stream(input_stream: asyncio.StreamReader, *output_stream: io.IOBase):
    while not input_stream.at_eof():
        output = await input_stream.readline()
        for _os in output_stream:
            _os.write(output)
            _os.flush()


# Run a subprocess and stream the output while it runs. Return the process' return code.
async def run_command(*command: str, **kwargs: Any) -> int:
    # Start the subprocess.
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        **kwargs,
    )
    # Since we passed `PIPE` for these, they should be available.
    assert process.stderr is not None
    assert process.stdout is not None

    # Stream stdout and stderr while it runs. Save all stdout to a file.
    with open("build.log", "ab") as f:
        # Note that the asyncio subprocess `stderr` and `stdout` produces bytes only, not text. So, we need to write to `sys.stdout/err` as binary. Therefore, use [.buffer](https://docs.python.org/3/library/io.html#io.TextIOBase.buffer).
        await asyncio.gather(
            output_stream(process.stderr, sys.stderr.buffer),
            output_stream(process.stdout, sys.stdout.buffer, f),
        )

    # Terminate it nicely.
    #
    # `process.communicate()` will have no data to read but will close the
    # pipes that are implemented in C, whereas `process.wait()`` will not.
    stdout_data, stderr_data = await process.communicate()
    assert not stdout_data and not stderr_data

    assert process.returncode is not None
    return process.returncode


## }


print("Building docker images...")
ret = asyncio.run(run_command("docker", "compose", "build"))
if ret == 0:
    print("Docker images built successfully")
else:
    print(
        "Docker images failed to build, see build.log for details (or run with --verbose)"
    )
    exit(1)
