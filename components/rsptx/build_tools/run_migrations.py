#!/usr/bin/env python3
#
# `run_migrations.py` - the ``rsmigrate`` console script
# ======================================================
# A thin wrapper around Alembic's command line so that end users who installed
# the ``rsadmin`` pip package (after running ``init_runestone.sh``) can apply
# database migrations without a source checkout::
#
#     rsmigrate upgrade head      # apply all pending migrations
#     rsmigrate current           # show the current revision
#     rsmigrate heads             # show the latest available revision(s)
#     rsmigrate downgrade -1      # roll back one revision
#     rsmigrate stamp head        # mark the DB as up to date without running
#
# The migration scripts and an ``alembic.ini`` are bundled inside the wheel
# (under ``rsptx/build_tools/_alembic``). We locate them, override Alembic's
# ``script_location`` with that absolute path so the command works from any
# directory, and let ``migrations/env.py`` pick the database URL from the
# environment (``DBURL`` when ``SERVER_CONFIG=production``, else ``DEV_DBURL``).
# The local ``.env`` (as written by ``init_runestone.sh``) is loaded first.

import os
import sys
from pathlib import Path

from alembic.config import CommandLine, Config

from rsptx.cl_utils.core import load_project_dotenv


def _find_alembic():
    """Return ``(alembic_ini_path, migrations_dir)`` as absolute Paths.

    Prefers the copy bundled in the installed wheel; falls back to the
    repo-root layout so ``rsmigrate`` also works from a source checkout.
    """
    bundled_dir = Path(__file__).parent / "_alembic"
    bundled_ini = bundled_dir / "alembic.ini"
    if bundled_ini.exists():
        return bundled_ini, bundled_dir / "migrations"

    # Source checkout: walk up until we find an alembic.ini that has a sibling
    # migrations/ directory (i.e. the repository root).
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "alembic.ini"
        if candidate.exists() and (parent / "migrations").is_dir():
            return candidate, parent / "migrations"

    raise SystemExit(
        "rsmigrate: could not locate the bundled alembic.ini / migrations "
        "directory. Reinstall the rsadmin package or run from a source checkout."
    )


def main():
    # Pick up DBURL / DEV_DBURL / SERVER_CONFIG from a local .env if present.
    load_project_dotenv()

    ini_path, migrations_dir = _find_alembic()

    # Parse the Alembic subcommand (upgrade/current/downgrade/...) ourselves so
    # we can inject an absolute script_location, making the command independent
    # of the current working directory. `--help` and unknown args exit here,
    # before we require a database URL.
    cmdline = CommandLine(prog="rsmigrate")
    options = cmdline.parser.parse_args(sys.argv[1:])
    if not hasattr(options, "cmd"):
        # No subcommand given: print help and exit non-zero, matching alembic.
        cmdline.parser.error("too few arguments")

    # A real command is about to run, which needs the database URL that
    # migrations/env.py reads from the environment.
    server_config = os.environ.get("SERVER_CONFIG")
    url_var = "DBURL" if server_config == "production" else "DEV_DBURL"
    if not os.environ.get(url_var):
        raise SystemExit(
            f"rsmigrate: {url_var} is not set (SERVER_CONFIG={server_config!r}). "
            f"Set {url_var} in your .env or environment to the Runestone "
            "database URL before running migrations."
        )

    cfg = Config(str(ini_path), cmd_opts=options)
    cfg.set_main_option("script_location", str(migrations_dir))
    cmdline.run_cmd(cfg, options)


if __name__ == "__main__":
    main()
