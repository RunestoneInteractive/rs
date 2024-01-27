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
import pdb

# use python-dotenv >= 0.21.0
from dotenv import load_dotenv
from rich.console import Console
from rich.live import Live
from rich.table import Table
import rich
from rsptx.cl_utils.core import pushd, stream_command, subprocess_streamer

console = Console()

# Check environment variables
# ---------------------------
print("Checking your environment")
if not os.path.exists(".env"):
    console.print(
        "No .env file found.  Please copy sample.env to .env and edit it.",
        style="bold red",
    )
    exit(1)

if "--verbose" in sys.argv:
    VERBOSE = True
else:
    VERBOSE = False

if "--help" in sys.argv:
    console.print(
        """Usage: build.py [--verbose] [--help] [--all] [--push]
        --all build all containers, including author and worker
        --push push all containers to a container registry
        --one <service> build just one container, e.g. --one author
        --restart restart the container(s) after building

        If something in the build does not work or you have questions about setup or environment
        variables or installation, please check out our developer documentation.
        https://runestone-monorepo.readthedocs.io/en/latest/developing.html
        """
    )
    exit(0)

# read the version from pyproject.toml
with open("pyproject.toml") as f:
    pyproject = toml.load(f)
    version = pyproject["tool"]["poetry"]["version"]

if "--push" in sys.argv:
    try:
        with open(".last_version") as f:
            last_version = f.read().strip()
    except FileNotFoundError:
        with open(".last_version", "w") as f:
            f.write(version)
            last_version = version

    if last_version == version:
        update_version = input(
            f"Do you want to update the version number ({version}) in pyproject.toml?"
        )
        if update_version.lower() in ["y", "yes"]:
            new_version = input("Enter the new version number: ")
            subprocess.run(
                ["poetry", "version", new_version], capture_output=True, check=True
            )
            console.out("Version updated, don't forget to commit the change.")
            version = new_version

res = subprocess.run("docker info", shell=True, capture_output=True)
if res.returncode != 0:
    console.print(
        "Docker is not running.  Please start it and try again.", style="bold red"
    )
    exit(1)

# make a fresh build.log for this build
with open("build.log", "w") as f:
    f.write("")

# Per the [docs](https://pypi.org/project/python-dotenv/), load `.env` into
# environment variables.
load_dotenv()
table = Table(title="Environment Variables")
table.add_column("Variable", justify="right", style="grey62", no_wrap=True)
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
    "COMPOSE_PROFILES",
]:
    if var not in os.environ:
        table.add_row(var, "[red]No[/red]")
        finish = True
    else:
        table.add_row(var, "[green]Yes[/green]")

console.print(table)

if "DC_DBURL" not in os.environ:
    console.print(
        "DC_DBURL not set.  It will default to DBURL, but you should set it in .env"
    )
    if "DBURL" not in os.environ:
        console.print("DBURL not set.  Please set it in .env", style="bold red")
        finish = True
else:
    console.print("DC_DBURL set.  Using it instead of DBURL")


if "DC_DEV_DBURL" not in os.environ:
    console.print(
        "DC_DEV_DBURL not set.  It will default to DEV_DBURL, but you should set it in .env",
        style="bold red",
    )
    if "DEV_DBURL" not in os.environ:
        console.print("DEV_DBURL not set.  Please set it in .env")
        finish = True
else:
    console.print("DC_DEV_DBURL set.  Using it instead of DEV_DBURL")

if "COMPOSE_PROFILES" not in os.environ:
    console.print(
        "COMPOSE_PROFILES not set.  Options include: basic, author, dev, production",
        style="bold red",
    )
    console.print(
        "the following services will not be started unless you use the --profile switch: db, author, worker pgbouncer, nginx_dstart_dev",
        style="bold red",
    )
    finish = False

if not os.path.isfile("bases/rsptx/web2py_server/applications/runestone/models/1.py"):
    console.print("Copying 1.py.prototype to 1.py")
    copyfile(
        "bases/rsptx/web2py_server/applications/runestone/models/1.py.prototype",
        "bases/rsptx/web2py_server/applications/runestone/models/1.py",
    )

if finish:
    console.print(
        "Your environment is not set up correctly.  Please define the environment variables listed above.",
        style="bold red",
    )
    exit(1)

ym = yaml.load(open("docker-compose.yml"), yaml.FullLoader)

# remove the redis service from the list since we don't customize it
del ym["services"]["redis"]

if "--all" not in sys.argv:
    # remove the author and worker services from the list since we don't customize them
    del ym["services"]["author"]
    del ym["services"]["worker"]

if "--one" in sys.argv:
    svc_to_build = sys.argv[sys.argv.index("--one") + 1]
    # remove all services except the one we want to build
    for svc in list(ym["services"].keys()):
        if svc != svc_to_build:
            del ym["services"][svc]

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


def progress_wheel():
    chars = "x+"
    progress_wheel.counter += 1
    return chars[progress_wheel.counter % 2]


progress_wheel.counter = 0


def generate_wheel_table(status: dict) -> Table:
    table = Table(title="Build Python Wheels")
    table.add_column("Wheel", justify="right", style="grey62", no_wrap=True)
    table.add_column("Built", style="magenta")
    for service in status:
        table.add_row(f"[black]{service}[/black]", status[service])
    return table


if "--install" in sys.argv:
    for proj in ym["services"].keys():
        if (
            "build" not in ym["services"][proj]
            or ym["services"][proj]["build"]["context"] == "./"
        ):
            continue
        projdir = ym["services"][proj]["build"]["context"]
        if os.path.isdir(projdir):
            with pushd(projdir):
                if os.path.isfile("pyproject.toml"):
                    console.print(f"Installing {proj}")
                    res = subprocess.run(
                        ["poetry", "install", "--with=dev"], capture_output=True
                    )
                    if res.returncode == 0:
                        console.print(f"Installed {proj}")
                    else:
                        console.print(f"Failed to install {proj}")
                        if VERBOSE:
                            console.print(res.stderr.decode(stdout_err_encoding))
                        else:
                            with open("build.log", "a") as f:
                                f.write(res.stderr.decode(stdout_err_encoding))
                else:
                    console.print(f"Skipping {proj} as it has no pyproject.toml")
                    continue
    sys.exit(0)

# Build wheels
# ------------
status = {}
with Live(generate_wheel_table(status), refresh_per_second=4) as lt:
    status = {}
    for proj in ym["services"].keys():
        if (
            "build" not in ym["services"][proj]
            or ym["services"][proj]["build"]["context"] == "./"
        ):
            status[proj] = "[blue]Skipped[/blue]"
            lt.update(generate_wheel_table(status))
            continue
        projdir = ym["services"][proj]["build"]["context"]
        if os.path.isdir(projdir):
            with pushd(projdir):
                status[proj] = "[grey62]building...[/grey62]"
                lt.update(generate_wheel_table(status))
                if os.path.isfile("pyproject.toml"):
                    res = subprocess.run(
                        ["poetry", "build-project"], capture_output=True
                    )
                    if res.returncode == 0:
                        status[proj] = "[green]Yes[/green]"
                        lt.update(generate_wheel_table(status))
                    else:
                        status[proj] = "[red]Fail[/red]"
                        lt.update(generate_wheel_table(status))
                        if VERBOSE:
                            console.print(res.stderr.decode(stdout_err_encoding))
                        else:
                            with open("build.log", "a") as f:
                                f.write(res.stderr.decode(stdout_err_encoding))
                else:
                    status[proj] = "[blue]Skipped[/blue]"
                    lt.update(generate_wheel_table(status))


# Generate a table for the Live object
# see https://rich.readthedocs.io/en/stable/live.html?highlight=update#basic-usage
def generate_table(status: dict) -> Table:
    table = Table(title="Build Docker Images")
    table.add_column("Service", justify="right", style="white", no_wrap=True)
    table.add_column("Built", style="magenta")
    for service in status:
        table.add_row(f"{service}", status[service])
    return table


# Build Docker containers
# -----------------------
console.print(
    "Building docker images (see build.log for detailed progress)...", style="bold"
)
status = {}
with Live(generate_table(status), refresh_per_second=4) as lt:
    status = {}
    for service in ym["services"]:
        status[service] = "[grey62]building...[/grey62]"
        lt.update(generate_table(status))
        # to use a different wheel without editing Dockerfile use --build-arg wheel="wheelname"
        command_list = [
            "docker",
            "compose",
            "-f",
            "docker-compose.yml",
            "--progress",
            "plain",
            "build",
            service,
        ]

        with open("build.log", "ab") as f:
            ret = subprocess.run(
                command_list,
                capture_output=True,
            )
            f.write(ret.stdout)
            f.write(ret.stderr)
        if ret.returncode == 0:
            status[service] = "[green]Yes[/green]"
            lt.update(generate_table(status))
        else:
            status[service] = "Failed"
            lt.update(generate_table(status))
            console.print(
                f"There was an error building {service} see build.log for details",
                style="bold red",
            )
            exit(1)


# Now if the --push flag was given, push the images to Docker Hub
# For this next part to work you need to be logged in to a docker hub account or the
# runestone private registry on digital ocean.  The docker-compose.yml file has the
# image names set up to push to the runestone registry on digital ocean.
if "--push" in sys.argv:
    console.print("Pushing docker images to Docker Hub...", style="bold")
    for service in ym["services"]:
        if "image" in ym["services"][service]:
            image = ym["services"][service]["image"]
            console.print(f"Pushing {image}")
            ret1 = subprocess.run(
                ["docker", "tag", image, f"{image}:v{version}"], check=True
            )
            # we do 2 pushes because the version tag is not automatically pushed
            # and we want to push both the latest and the version tagged images
            # but it is low cost as we only push the layers that are not already
            # on the server.
            ret2 = subprocess.run(["docker", "push", "--quiet", image], check=True)
            ret3 = subprocess.run(
                ["docker", "push", "--quiet", f"{image}:v{version}"], check=True
            )

            if ret1.returncode + ret2.returncode + ret3.returncode == 0:
                console.print(f"{image} pushed successfully")
                ret = 0
            else:
                console.print(f"{image} failed to push", style="bold red")
                exit(1)

    console.print("Docker images pushed successfully", style="green")
    with open(".last_version", "w") as f:
        f.write(version)


if "--restart" in sys.argv:
    if "--all" in sys.argv:
        command_list = [
            "docker",
            "compose",
            "--profile",
            "author",
            "-f",
            "docker-compose.yml",
            "stop",
        ]
        console.print("Restarting all services...", style="bold")
    elif "--one" in sys.argv:
        command_list = [
            "docker",
            "compose",
            "-f",
            "docker-compose.yml",
            "stop",
            svc_to_build,
        ]
        console.print(f"Restarting the {svc_to_build} service...", style="bold")
    else:
        command_list = ["docker", "compose", "stop"]
        console.print("Restarting non-author services...", style="bold")
    ret1 = subprocess.run(
        command_list,
        capture_output=True,
    )
    if "--all" in sys.argv:
        command_list = [
            "docker",
            "compose",
            "--profile",
            "author",
            "-f",
            "docker-compose.yml",
            "up",
            "-d",
        ]
    elif "--one" in sys.argv:
        command_list = [
            "docker",
            "compose",
            "--profile",
            "author",
            "--profile",
            "basic",
            "--profile",
            "dev",
            "--profile",
            "production",
            "-f",
            "docker-compose.yml",
            "up",
            "-d",
            svc_to_build,
        ]
    else:
        command_list = ["docker", "compose", "up", "-d"]
    ret2 = subprocess.run(
        command_list,
        capture_output=True,
    )
    if ret1.returncode + ret2.returncode == 0:
        console.print("Runestone service(s) restarted successfully", style="green")
    else:
        console.print("Runestone services failed to restart", style="bold red")
