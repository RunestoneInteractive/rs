#!/usr/bin/env python3

import os
import locale
from shutil import copyfile
import subprocess
import sys

# use python-dotenv >= 0.21.0
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.live import Live
from rsptx.cl_utils.core import pushd
import sh

print("Checking your environment")
if not os.path.exists(".env"):
    print("No .env file found.  Please copy sample.env to .env and edit it.")
    exit(1)

if "--verbose" in sys.argv:
    VERBOSE = True
else:
    VERBOSE = False

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
    # copy 1.py.prototype to 1.py
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
    stdout_err_encoding = locale.getencoding()
except AttributeError:
    stdout_err_encoding = locale.getpreferredencoding()

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


# When using subprocess there is no nice way to try (short of threads) to capture the output and send
# it to the console while also capturing it to a file.  So we use sh instead.
# https://amoffat.github.io/sh/index.html
# sh "knows" about all of the commands on your PATH

# define a function that will take the output from the background process
# if it matches a pattern we are looking for, print it to the console
def process_output(line, stdin, process):
    if "naming to docker.io" in line and "done" in line:
        print(line[line.rindex("/") + 1 :].replace("done", "").strip())


print("Building docker images...")
# res = subprocess.run(["docker", "compose", "build"], capture_output=True)

try:
    # such a cool way to run "docker compose build" and capture the output
    res = sh.docker.compose.build(
        "--progress", "plain", _out=process_output, _bg=True, _tee=True
    )
    res.wait()
    print("Docker images built successfully")
    with open("build.log", "a") as f:
        f.write(res.stdout.decode(stdout_err_encoding))
except sh.ErrorReturnCode:
    print(
        "Docker images failed to build, see build.log for details (or run with --verbose)"
    )
    print(res.stderr.decode(stdout_err_encoding))
    with open("build.log", "a") as f:
        f.write(res.stderr.decode(stdout_err_encoding))
    exit(1)
