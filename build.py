#!/usr/bin/env python3
#
# `build.py` - Build the wheels and Docker containers needed for this
# application
# ===================================================================
#
# Imports
# -------
import locale
import os
import subprocess
import sys
from shutil import copyfile
import yaml
import toml

# use python-dotenv >= 0.21.0
from dotenv import load_dotenv
from rich.console import Console
from rich.live import Live
from rich.table import Table
from rsptx.cl_utils.core import pushd, stream_command, subprocess_streamer

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

if "--help" in sys.argv:
    print(
        """Usage: build.py [--verbose] [--help] [--all] [--push]
        --all build all containers, including author and worker
        --push push all containers to docker hub
        """
    )
    exit(0)

res = subprocess.run("docker info", shell=True, capture_output=True)
if res.returncode != 0:
    print("Docker is not running.  Please start it and try again.")
    exit(1)

# Per the [docs](https://pypi.org/project/python-dotenv/), load `.env` into
# environment variables.
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

# Attempt to determine the encoding of data returned from stdout/stderr of
# subprocesses. This is non-trivial. See the discussion at [Python's
# sys.stdout](https://docs.python.org/3/library/sys.html#sys.stdout). First, try
# `locale.getencoding()` (requires >= 3.11), with a fallback to
# `locale.getpreferredencoding()`.
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
    # Since this isn't defined on all Python versions, tell mypy to ignore the
    # following error.
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

ym = yaml.safe_load(open("docker-compose.yml"))
# remove the redis service from the list since we don't customize it
del ym["services"]["redis"]


# Generate a table for the Live object
# see https://rich.readthedocs.io/en/stable/live.html?highlight=update#basic-usage
def generate_table(status):
    table = Table(title="Build Docker Images")
    table.add_column("Service", justify="right", style="cyan", no_wrap=True)
    table.add_column("Built", style="magenta")
    for service in status:
        table.add_row(service, status[service])
    return table


# Build Docker containers
# -----------------------
print("Building docker images (see build.log for detailed progress)...")
with Live(table, refresh_per_second=4) as lt:
    status = {}
    for service in ym["services"]:
        if service in ["author", "worker"] and "--all" not in sys.argv:
            status[service] = "skipped"
            continue
        else:
            status[service] = "building"
        lt.update(generate_table(status))
        with open("build.log", "ab") as f:
            ret = stream_command(
                "docker",
                "compose",
                "build",
                service,
                "--progress",
                "plain",
                # For stdout, stream only high points of the build to stdout; save
                # *everything* to the log file.
                stdout_streamer=subprocess_streamer(
                    sys.stdout.buffer,
                    f,
                    filter=lambda line: (
                        # Only show lines to stdout like `#18 naming to
                        # docker.io/library/rs-jobe 0.2s done`; just report the
                        # container name for brevity.
                        b"Finished "
                        + line[line.rindex(b"/") + 1 :].replace(b" done", b"").strip()
                        + b"\n"
                        if b"naming to docker.io" in line and b"done" in line
                        else b"",
                        # Save everything to the file.
                        line,
                    ),
                ),
                stderr_streamer=subprocess_streamer(sys.stderr.buffer, f),
            )
        if ret == 0:
            status[service] = "built"
            lt.update(generate_table(status))
        else:
            status[service] = "failed"
            lt.update(generate_table(status))
            print(f"There was an error building {service} see build.log for details")
            exit(1)

# read the version from pyproject.toml
with open("pyproject.toml") as f:
    pyproject = toml.load(f)
    version = pyproject["tool"]["poetry"]["version"]

# Now if the --push flag was given, push the images to Docker Hub
# For this next part to work you need to be logged in to a docker hub account or the
# runestone private registry on digital ocean.  The docker-compose.yml file has the
# image names set up to push to the runestone registry on digital ocean.
if "--push" in sys.argv:
    print("Pushing docker images to Docker Hub...")
    for service in ym["services"]:
        if "image" in ym["services"][service]:
            image = ym["services"][service]["image"]
            print(f"Pushing {image}")
            ret1 = subprocess.run(
                ["docker", "tag", image, f"{image}:v{version}"], check=True
            )
            # we do 2 pushes because the version tag is not automatically pushed
            # and we want to push both the latest and the version tagged images
            # but it is low cost as we only push the layers that are not already
            # on the server.
            ret2 = subprocess.run(["docker", "push", image], check=True)
            ret3 = subprocess.run(["docker", "push", f"{image}:v{version}"], check=True)

            if ret1.returncode + ret2.returncode + ret3.returncode == 0:
                print(f"{image} pushed successfully")
                ret = 0
            else:
                print(f"{image} failed to push")
                exit(1)

    print("Docker images pushed successfully")
