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
import pdb  # noqa
from collections import OrderedDict
from datetime import datetime

# use python-dotenv >= 0.21.0
from dotenv import load_dotenv
from rich.console import Console
from rich.live import Live
from rich.table import Table
from sqlalchemy import create_engine, inspect
import click
from rsptx.cl_utils.core import pushd


class Config(object):
    def __init__(self):
        self.verbose = False


pass_config = click.make_pass_decorator(Config, ensure=True)

console = Console()


@click.group(chain=True)
@click.option("--verbose", is_flag=True, help="Show more output")
@click.option(
    "--all",
    is_flag=True,
    show_default=True,
    help="Build all containers, including author and worker",
    default=False,
)
@click.option(
    "--core",
    is_flag=True,
    show_default=True,
    help="Build only the core services",
    default=False,
)
@click.option("-s", "--service", multiple=True, help="Build one service - multiple ok")
@click.option(
    "--clean", is_flag=True, help="Remove all containers and images before starting"
)
@pass_config
def cli(config, verbose, all, core, service, clean):
    """
    Build the wheels and Docker containers needed for this application
    You can control which parts of the pipeline to run and which services to build or
    restart.  The default is to build the core services and restart them.  Here are some
    examples:
    build --core full
    build wheel image restart
    build wheel image push
    build --service author --service worker wheel image restart
    build push -- push the built images to the registry
    """

    os.chdir(findProjectRoot())

    if not os.path.exists(".env"):
        console.print(
            "No .env file found.  Please copy sample.env to .env and edit it.",
            style="bold red",
        )
        exit(1)
    config.verbose = verbose

    if clean:
        clean_all()

    if not service and not all:
        click.echo("No services specified, building core services")
        core = True

    with open("pyproject.toml") as f:
        config.pyproject = toml.load(f)
        config.version = config.pyproject["tool"]["poetry"]["version"]

    res = subprocess.run("docker info", shell=True, capture_output=True)
    if res.returncode != 0:
        console.print(
            "Docker is not running.  Please start it and try again.", style="bold red"
        )
        exit(1)

    # make a fresh build.log for this build
    with open("build.log", "w") as f:
        f.write("")

    ym = yaml.load(open("docker-compose.yml"), yaml.FullLoader)

    config.orig = ym.copy()

    # remove the redis service from the list since we don't customize it
    del ym["services"]["redis"]

    # add the interactives service to the list so it gets built before the others,
    # assignments depend on it.  We do not build a container for it, but we do build the wheels
    ym["services"]["interactives"] = {"build": {"context": "./projects/interactives"}}
    ym["services"]["interactives"]["image"] = "skip"
    ym["services"] = OrderedDict(ym["services"])  # convert to ordered dict
    ym["services"].move_to_end("interactives", last=False)

    # remove all services except the one we want to build
    if service:
        core = False
        svc_list = [x for x in ym["services"].keys()]
        for svc in svc_list:
            if svc not in service:
                del ym["services"][svc]

    if core:
        svc_list = [x for x in ym["services"].keys()]
        to_remove = [
            "author",
            "worker",
            "nginx_dstart_dev",
            "pgbouncer",
            "interactives",
            "db",
        ]
        if not os.path.exists(
            "bases/rsptx/interactives/runestone/dist/webpack_static_imports.json"
        ):
            to_remove.remove("interactives")
            click.echo("Keeping interactives in the build list since they are missing")
        for svc in svc_list:
            if svc in to_remove:
                del ym["services"][svc]
    # Now initialize the build.log files for all services
    for service in ym["services"]:
        now = datetime.now()
        try:
            _ = ym["services"][service]["build"]["context"]
        except KeyError:
            continue
        with pushd(ym["services"][service]["build"]["context"]):
            with open("build.log", "w") as f:
                f.write(f"Build log for {service} on {now}\n")

    service_list = ", ".join(ym["services"].keys())
    console.print(f"Building services: {service_list}", style="bold")

    config.all = all
    config.core = core
    config.ym = ym


def clean_all():
    console.print("Removing all containers and images...", style="bold")
    ret = subprocess.run(["docker", "system", "prune", "--force"], capture_output=True)
    if ret.returncode == 0:
        console.print("All containers and images removed successfully", style="green")
    else:
        console.print("Failed to remove all containers and images", style="bold red")
        exit(1)


def findProjectRoot():
    start = os.getcwd()
    prevdir = ""
    while start != prevdir:
        if os.path.exists(os.path.join(start, "docker-compose.yml")):
            if prevdir != "":
                console.print(
                    f"Changing working directory to {start}", style="bold blue"
                )
            return start
        prevdir = start
        start = os.path.dirname(start)
    raise IOError("You must be in the rs repo to run the build command")


@cli.command()
@pass_config
def list(config):
    """List the services and last build"""

    table = Table(title="Services")
    table.add_column("Service", justify="right", style="grey62", no_wrap=True)
    table.add_column("Last Built", style="magenta")

    for s in config.orig["services"]:
        # get the mtime of build.log in project/service and print it
        try:
            projdir = config.orig["services"][s]["build"]["context"]
        except KeyError:
            mtime = "No Context"
            continue
        with pushd(projdir):
            try:
                mtime = os.path.getmtime("build.log")
                mtime = datetime.fromtimestamp(mtime)
            except FileNotFoundError:
                mtime = "Not Built"
            #            console.print(f"{s} - {mtime}")
            table.add_row(s, str(mtime))
    console.print(table)


@cli.command()
@pass_config
def env(config):
    """Check key environment variables and exit"""

    console.print("Checking environment variables", style="bold")

    # Per the [docs](https://pypi.org/project/python-dotenv/), load `.env` into
    # environment variables.
    load_dotenv()
    table = Table(title="Environment Variables")
    table.add_column("Variable", justify="right", style="grey62", no_wrap=True)
    if config.verbose:
        table.add_column("Value", style="magenta")
    else:
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
        "DBURL",
        "DEV_DBURL",
    ]:
        if var not in os.environ:
            table.add_row(var, "[red]No[/red]")
            finish = True
        else:
            if config.verbose:
                table.add_row(var, os.environ[var])
            else:
                table.add_row(var, "[green]Yes[/green]")

    if "DC_DBURL" not in os.environ:
        table.add_row("DC_DBURL", "[red]No[/red] will default to DBURL")
        if "DBURL" not in os.environ:
            table.add_row("DBURL", "[red]No[/red] please set it in .env")
            finish = True
    else:
        if config.verbose:
            table.add_row("DC_DBURL", os.environ["DC_DBURL"])
        else:
            table.add_row("DC_DBURL", "[green]Yes[/green]")

    if "DC_DEV_DBURL" not in os.environ:
        table.add_row("DC_DEV_DBURL", "[red]No[/red] will default to DEV_DBURL")
        if "DEV_DBURL" not in os.environ:
            table.add_row("DEV_DBURL", "[red]No[/red] please set it in .env")
            finish = True
    else:
        if config.verbose:
            table.add_row("DC_DEV_DBURL", os.environ["DC_DEV_DBURL"])
        else:
            table.add_row("DC_DEV_DBURL", "[green]Yes[/green]")

    console.print(table)

    cprofs = os.environ.get("COMPOSE_PROFILES", "")
    if "basic" in cprofs:
        console.print("Basic profile enabled")
        if "2345" not in os.environ.get("DEV_DBURL", ""):
            console.print(
                "DEV_DBURL is not using port 2345.  This is required to connect to a dockerized postgres instance.  Please set it in .env",
                style="bold red",
            )
            finish = True
    else:
        console.print(
            "You are configured to run your own DB instance.  Make sure it is running."
        )
        console.print(
            "If you don't want to run your own, then enable the basic profile."
        )
        if "2345" in os.environ.get("DEV_DBURL", ""):
            console.print(
                "DEV_DBURL is using port 2345.  This is probably not correct if you are running postgres outside of docker",
                style="bold red",
            )
            finish = True

    if "COMPOSE_PROFILES" not in os.environ:
        console.print(
            "COMPOSE_PROFILES not set.  Options include: basic, author, dev, production",
            style="bold red",
        )
        console.print(
            """
            The following services [red]will not be started[/red] unless you use set your COMPOSE_PROFILES in .env
            [green]db, author, worker pgbouncer, nginx_dstart_dev[/green]
            See the sample.env file for more information to set this variable.
            You can also use the --profile switch with docker compose to enable a specific profile.
            """,
            style="bold",
        )
        finish = False

    if not os.path.isfile(
        "bases/rsptx/web2py_server/applications/runestone/models/1.py"
    ):
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
    table.add_column("Wheel", justify="right", style="white", no_wrap=True)
    table.add_column("Built", style="magenta")
    for service in status:
        table.add_row(service, status[service])
    return table


@cli.command()
@pass_config
def wheel(config):
    """Build the python wheels"""
    status = {}
    with Live(generate_wheel_table(status), refresh_per_second=4) as lt:
        status = {}
        for proj in config.ym["services"].keys():
            if (
                "build" not in config.ym["services"][proj]
                or config.ym["services"][proj]["build"]["context"] == "./"
            ):
                status[proj] = "[blue]Skipped[/blue]"
                lt.update(generate_wheel_table(status))
                continue
            projdir = config.ym["services"][proj]["build"]["context"]
            if os.path.isdir(projdir):
                with pushd(projdir):
                    if os.path.isfile("build.py"):
                        status[proj] = "[grey62]pre build...[/grey62]"
                        lt.update(generate_wheel_table(status))
                        res = subprocess.run(
                            ["python", "build.py", "--fromroot"], capture_output=True
                        )
                        if res.returncode == 0:
                            status[proj] = "[green]Yes[/green]"
                            lt.update(generate_wheel_table(status))
                            with open("build.log", "a") as f:
                                f.write(res.stdout.decode(stdout_err_encoding))
                        else:
                            status[proj] = f"[red]Fail[/red] See {projdir}/build.log"
                            lt.update(generate_wheel_table(status))
                            if config.verbose:
                                console.print(res.stderr.decode(stdout_err_encoding))
                            else:
                                with open("build.log", "a") as f:
                                    f.write(res.stderr.decode(stdout_err_encoding))
                                    f.write(res.stdout.decode(stdout_err_encoding))
                            sys.exit(1)
                    if os.path.isfile("pyproject.toml"):
                        status[proj] = "[grey62]building...[/grey62]"
                        lt.update(generate_wheel_table(status))
                        toml_stat = os.stat("pyproject.toml")
                        lock_stat = os.stat("poetry.lock")
                        if toml_stat.st_mtime > lock_stat.st_mtime:
                            res = subprocess.run(
                                ["poetry", "--version"], capture_output=True
                            )
                            # poetry 2.0 removed the --no-update flag (it is the default)
                            lock_opts = ["poetry", "lock"]
                            if "version 1" in res.stdout.decode(stdout_err_encoding):
                                lock_opts.append("--no-update")

                            res = subprocess.run(lock_opts, capture_output=True)
                            if res.returncode != 0:
                                status[proj] = (
                                    f"[red]Fail[/red] probable dependency conflict see {projdir}/build.log"
                                )
                                lt.update(generate_wheel_table(status))
                                if config.verbose:
                                    console.print(
                                        res.stderr.decode(stdout_err_encoding)
                                    )
                                else:
                                    with open("build.log", "a") as f:
                                        f.write(res.stderr.decode(stdout_err_encoding))
                                sys.exit(1)
                        res = subprocess.run(
                            ["poetry", "build-project"], capture_output=True
                        )
                        if res.returncode == 0:
                            status[proj] = "[green]Yes[/green]"
                            lt.update(generate_wheel_table(status))
                            with open("build.log", "a") as f:
                                f.write(res.stdout.decode(stdout_err_encoding))
                        else:
                            status[proj] = f"[red]Fail[/red] see {projdir}/build.log"
                            lt.update(generate_wheel_table(status))
                            if config.verbose:
                                console.print(res.stderr.decode(stdout_err_encoding))
                            else:
                                with open("build.log", "a") as f:
                                    f.write(res.stderr.decode(stdout_err_encoding))
                            sys.exit(1)
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


@cli.command()
@pass_config
def image(config):
    """Build the docker images"""

    console.print(
        "Building docker images (see build.log for detailed progress)...", style="bold"
    )
    status = {}
    with Live(generate_table(status), refresh_per_second=4) as lt:
        status = {}
        for service in config.ym["services"]:
            if service == "interactives":
                status[service] = "[grey62]skipped...[/grey62]"
                lt.update(generate_table(status))
                continue
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
@cli.command()
@pass_config
def push(config):
    """Push the images to Docker Hub"""
    try:
        with open(".last_version") as f:
            last_version = f.read().strip()
    except FileNotFoundError:
        with open(".last_version", "w") as f:
            f.write(config.version)
            last_version = config.version

    if last_version == config.version:
        update_version = input(
            f"Do you want to update the version number ({config.version}) in pyproject.toml?"
        )
        if update_version.lower() in ["y", "yes"]:
            new_version = input("Enter the new version number: ")
            subprocess.run(
                ["poetry", "version", new_version], capture_output=True, check=True
            )
            console.out("Version updated, don't forget to commit the change.")
            # add a git tag for the new version
            subprocess.run(
                ["git", "tag", f"v{new_version}"], capture_output=True, check=True
            )
            subprocess.run(
                ["git", "push", "--tags"], capture_output=True, check=True
            )
            config.version = new_version

    console.print("Pushing docker images to Docker Hub...", style="bold")
    for service in config.ym["services"]:
        if "image" in config.ym["services"][service]:
            image = config.ym["services"][service]["image"]
            if "ghcr.io" not in image:
                continue
            console.print(f"Pushing {image}")
            ret1 = subprocess.run(
                ["docker", "tag", image, f"{image}:v{config.version}"], check=True
            )
            # we do 2 pushes because the version tag is not automatically pushed
            # and we want to push both the latest and the version tagged images
            # but it is low cost as we only push the layers that are not already
            # on the server.
            ret2 = subprocess.run(["docker", "push", "--quiet", image], check=True)
            ret3 = subprocess.run(
                ["docker", "push", "--quiet", f"{image}:v{config.version}"], check=True
            )

            if ret1.returncode + ret2.returncode + ret3.returncode == 0:
                console.print(f"{image} pushed successfully")
            else:
                console.print(f"{image} failed to push", style="bold red")
                exit(1)

    console.print("Docker images pushed successfully", style="green")
    with open(".last_version", "w") as f:
        f.write(config.version)


@cli.command()
@pass_config
def checkdb(config):
    """Check the database and run migrations"""
    # Check the database
    # ------------------
    engine = create_engine(os.environ["DEV_DBURL"])
    try:
        inspector = inspect(engine)
        _ = engine.connect()
    except Exception as e:
        console.print(f"Failed to connect to the database: {e}", style="bold red")
        exit(1)
    DBOK = True
    # Check if the alembic_version table is present in the database
    try:
        inspector.get_table_names().index("useinfo")
    except Exception:
        console.print(
            "It appears your database has not been initialized or your database is not started. Please see the documentation for how to initialize the database.",
            style="bold red",
        )
        DBOK = False
    try:
        inspector.get_table_names().index("alembic_version")
    except Exception:
        console.print(
            "The Migrations have not been set up for your database.  You need to run the alembic stamp head command to create it.",
            style="bold red",
        )
        DBOK = False

    if DBOK:
        console.print("Database appears to be set up correctly", style="green")
        console.print("Will now check for any needed migrations")
        res = subprocess.run(["alembic", "heads"], check=True, capture_output=True)
        head = res.stdout.decode("utf-8").split()[0].strip()
        console.print(f"Alembic head is {head}")
        res = subprocess.run(["alembic", "current"], check=True, capture_output=True)
        current = res.stdout.decode("utf-8").split("\n")[-2].split()[0].strip()
        console.print(f"Alembic current is {current}")
        if res.returncode == 0:
            if head == current:
                console.print(
                    "Your database schema appears to be up to date", style="green"
                )
            else:
                console.print("Database migrations are needed.  Running them now...")
                res = subprocess.run(["alembic", "upgrade", "head"], check=True)
                if res.returncode == 0:
                    console.print("Migrations completed successfully", style="green")
                else:
                    console.print("Migrations failed", style="bold red")
                    res = subprocess.run(
                        ["alembic", "upgrade", "--sql", "head"], capture_output=True
                    )
                    console.print(
                        "Try running the following commands manually in psql to see what went wrong."
                    )
                    console.print(
                        "Then run [green]alembic stamp head[/green] to mark the migrations as complete."
                    )
                    console.print(res.stdout.decode("utf-8"))

    if not DBOK:
        exit(1)


@cli.command()
@pass_config
def restart(config):
    """Restart the runestone docker services"""
    profiles = []
    profiles += [prof for prof in os.environ.get("COMPOSE_PROFILES", "").split(",")]
    profiles = [prof for prof in profiles if prof]
    if config.all or config.core:
        console.print("Restarting all services...", style="bold")
        if config.all and "author" not in profiles:
            profiles.append("author")
            os.environ["COMPOSE_PROFILES"] = ",".join(profiles)
        command_list = [
            "docker",
            "compose",
            "-f",
            "docker-compose.yml",
            "stop",
        ]
        ret1 = subprocess.run(
            command_list,
            capture_output=True,
        )
        if ret1.returncode != 0:
            console.print("Runestone services failed to stop", style="bold red")
            if config.verbose:
                console.print(ret1.stderr.decode("utf-8"))
            exit(1)
    else:
        for service in config.ym["services"]:
            command_list = [
                "docker",
                "compose",
                "-f",
                "docker-compose.yml",
                "stop",
                service,
            ]
            console.print(f"Restarting the {service} service...", style="bold")
            ret1 = subprocess.run(
                command_list,
                capture_output=True,
            )
            if ret1.returncode != 0:
                console.print(
                    f"Runestone service {service} failed to stop", style="bold red"
                )
                exit(1)
    if config.all or config.core:
        command_list = [
            "docker",
            "compose",
            "-f",
            "docker-compose.yml",
            "up",
            "-d",
        ]
        ret2 = subprocess.run(
            command_list,
            capture_output=True,
        )
        if ret2.returncode != 0:
            console.print("Runestone services failed to restart", style="bold red")
            exit(1)
    else:
        for service in config.ym["services"]:
            command_list = [
                "docker",
                "compose",
                "-f",
                "docker-compose.yml",
                "up",
                "-d",
                service,
            ]
            ret2 = subprocess.run(
                command_list,
                capture_output=True,
            )
            if ret2.returncode != 0:
                console.print(
                    f"Runestone service {service} failed to restart", style="bold red"
                )
                exit(1)
    console.print("Runestone services restarted successfully", style="green")


# This is a cool trick with click that lets you chain commands together to
# form a meta command. so this will run the env command first, then the wheel
# command, then the image command, then checkdb, then the restart command.
@cli.command()
@pass_config
@click.pass_context
def full(ctx, config):
    """Check the environment, Build the wheels, images, and run migrations, then restart the services"""
    ctx.invoke(env)
    ctx.invoke(wheel)
    ctx.invoke(image)
    ctx.invoke(checkdb)
    ctx.invoke(restart)


# This is a cool trick with click that lets you chain commands together to
# form a meta command. so this will run the env command first, then the wheel
# command, then the image command, then checkdb, then the restart command.
@cli.command()
@pass_config
@click.pass_context
def dev(ctx, config):
    """Build the wheels, images, and restart the services"""
    ctx.invoke(wheel)
    ctx.invoke(image)
    ctx.invoke(restart)


if __name__ == "__main__":
    cli()
