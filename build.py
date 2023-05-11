#!/usr/bin/env python3


import os
import subprocess
import sys

# use python-dotenv >= 0.21.0
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.live import Live
from rsptx.cl_utils.core import pushd

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
    "DBURL",
    "DEV_DBURL",
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

if not os.path.isfile("bases/rsptx/web2py_server/applications/runestone/models/1.py"):
    # copy 1.py.prototype to 1.py
    print("Copying 1.py.prototype to 1.py")
    subprocess.run(
        [
            "cp",
            "bases/rsptx/web2py_server/applications/runestone/models/1.py.prototype",
            "bases/rsptx/web2py_server/applications/runestone/models/1.py",
        ]
    )


if finish:
    print(
        "Your environment is not set up correctly.  Please define the environment variables listed above."
    )
    exit(1)

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
                            print(res.stderr.decode("utf-8"))
                        else:
                            with open("build.log", "a") as f:
                                f.write(res.stderr.decode("utf-8"))


# console.print(table)

print("Building docker images...")
res = subprocess.run(["docker", "compose", "build"], capture_output=True)
if res.returncode == 0:
    print("Docker images built successfully")
    with open("build.log", "a") as f:
        f.write(res.stdout.decode("utf-8"))
else:
    print(
        "Docker images failed to build, see build.log for details (or run with --verbose)"
    )
    print(res.stderr.decode("utf-8"))
    with open("build.log", "a") as f:
        f.write(res.stderr.decode("utf-8"))
    exit(1)
