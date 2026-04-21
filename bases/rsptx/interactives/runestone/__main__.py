# *********
# |docname|
# *********

from runestone import cmap
import sys
import os
import six
import click
import pathlib
from paver.easy import sh
import importlib.metadata
from runestone.server import get_dburl
from rsptx.build_tools.core import update_library, populate_static, manifest_data_to_db
from rsptx.cl_utils.core import load_project_dotenv


def lets_exit(code=0):
    click.echo(
        click.style(
            "The runestone command is deprecated.  You should convert your book to PreTeXt.",
            fg="yellow",
            bold=True,
        ),
        color=True,
    )
    sys.exit(code)


def deprecation_warning():
    click.echo(
        click.style(
            """The runestone command and RST extensions are deprecated.
You should convert your book to PreTeXt.
We will continue to add features to the interactive components, but
you will only have access to them through PreTeXt.
If you want to continue with RST, you can install 7.13.x""",
            fg="yellow",
            bold=True,
        ),
        color=True,
    )


if len(sys.argv) == 2:
    if "--version" in sys.argv:
        version = importlib.metadata.version("runestone")
        print("Runestone version {}".format(version))
        lets_exit()

load_project_dotenv()


@click.group(chain=True)
@click.option("--version", is_flag=True, help="More print version and exit")
def cli(version):
    """
    Usage: runestone [--version] subcommand

    """
    if version:
        version = importlib.metadata.version("runestone")
        print("Runestone version {}".format(version))
        lets_exit()


@cli.command()
def init():
    click.echo("The runestone command is deprecated, you should convert your book to PreTeXt.")
    click.echo("if you want to continue with RST, you can install 7.13.x")


@cli.command()
@click.option("--all/--not-all", default=False, help="build all")
@click.option("--wd", default=None, help="change working directory before build")
def build(all, wd):
    click.echo("The runestone command is deprecated, you should convert your book to PreTeXt.")
    click.echo("if you want to continue with RST, you can install 7.13.x")


@cli.command(short_help="preview the book in a minimal server (NO API support)")
@click.option("--port", default=8000, help="port for server to listen on")
@click.option("--listen", default="", help="address for server to listen on")
def preview(port, listen):
    _preview(port, listen)


def _preview(port, listen):
    click.echo("Note: this is a minimal static server without templates or a database.")
    click.echo("For many use cases this is fine.")
    click.echo(
        "For the full server, see https://github.com/RunestoneInteractive/rs"
    )
    os.chdir(findProjectRoot())
    sys.path.insert(0, os.getcwd())
    try:
        import pavement

        try:
            if pavement.dynamic_pages == True:
                click.echo(
                    click.style(
                        """Error -- dynamic_pages is True, but this preview server does not support templates.
                    Please edit pavement.py and set dynamic_pages=False""",
                        color="red",
                    ),
                    err=True,
                )
                click.echo("You should update pavement.py and rebuild")
                return
        except:
            click.echo("dynamic_pages is not defined")
    except:
        print("Error, you must be in your project root directory")
        return

    os.chdir(pavement.serving_dir)

    if six.PY2:
        import SimpleHTTPServer
        import SocketServer

        Handler = SimpleHTTPServer.SimpleHTTPRequestHandler
        httpd = SocketServer.TCPServer((listen, port), Handler, bind_and_activate=False)
    else:
        import http.server
        import socketserver

        Handler = http.server.SimpleHTTPRequestHandler
        httpd = socketserver.TCPServer((listen, port), Handler, bind_and_activate=False)

    print("serving at port", port)
    httpd.allow_reuse_address = True
    httpd.server_bind()
    httpd.server_activate()
    sys.stderr = open("runestone.log", "a")
    httpd.serve_forever()


# configure preview as an alias for serve
@cli.command(short_help="Deprecated - use preview")
@click.option("--port", default=8000, help="port for server to listen on")
@click.option("--listen", default="", help="address for server to listen on")
def serve(port, listen):
    click.echo("The serve command is deprecated, use runestone preview")
    _preview(port, listen)




@cli.command(short_help="type runestone doc directive to get help on directive")
@click.option("--list", is_flag=True, help="List all commands")
@click.argument("directive", nargs=-1)
def doc(directive=None, list=None):
    """
    Show Format and all options for a runestone directive
    """
    if list:
        print("Runestone Directives List")
        print("  ", "\n   ".join(sorted(cmap.keys())))
        return

    if directive:
        directive = directive[0]
        if directive in cmap:
            print(cmap[directive].__doc__)
        else:
            print("""Unknown Directive.  Possible values are""")
            print("  ", "\n   ".join(sorted(cmap.keys())))


@cli.command(short_help="Update template files")
def update():
    click.echo("The runestone command is deprecated, you should convert your book to PreTeXt.")
    click.echo("if you want to continue with RST, you can install 7.13.x")


@cli.command(short_help="Process runestone-manifest.xml file")
@click.option("--course", help="Name of the course (base course)")
@click.option(
    "--manifest",
    default="runestone-manifest.xml",
    help="path to runestone-manifest.xml file",
)
def process_manifest(course, manifest):
    """Populate a runestone database with meta data about a course created with the PreTeXt processor

    Arguments:
        course {string} -- Name of the base course
        manifest {path} -- Path to manifest file

    Raises:
        IOError: If manifest file not found
    """
    if os.path.exists(manifest):
        manifest_data_to_db(course, manifest)
    else:
        raise IOError("You must provide a valid path to a manifest file")


@cli.command(short_help="Fetch Javascript/CSS from CDN and copy to _static")
@click.option("--course", help="Name of the course (base course)")
def fetch_latest_static(course):
    config = type("config", (object,), {})()
    config.dburl = get_dburl()
    os.chdir(findProjectRoot())
    manifest = "runestone-manifest.xml"
    mpath = pathlib.Path(os.getcwd(), "published", course, manifest)
    populate_static(config, mpath, course)


def main(args=None):
    sys.dont_write_bytecode = True
    if not args:
        args = sys.argv[1:]
    if not args:
        print("""Usage: runestone help for a list of commands""")
        lets_exit(0)
    cli.add_command(init)
    cli.add_command(build)
    cli.add_command(serve)
    cli.add_command(doc)
    cli.add_command(update)
    cli()


def findProjectRoot():
    start = os.getcwd()
    prevdir = ""
    while start != prevdir:
        if os.path.exists(os.path.join(start, "pavement.py")):
            return start
        if os.path.exists(os.path.join(start, "project.ptx")):
            return start
        prevdir = start
        start = os.path.dirname(start)
    raise IOError("You must be in a runestone project to run runestone")


if __name__ == "__main__":
    lets_exit(main(sys.argv[1:]))
