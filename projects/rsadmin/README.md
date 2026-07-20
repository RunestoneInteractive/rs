# rsadmin

Host-side admin CLI for a Runestone server. Bundles the management and build
tooling that otherwise lives only inside the Docker images, so you can run it
directly on the machine where you set up Runestone.

## Prerequisites

Run [`init_runestone.sh`](https://raw.githubusercontent.com/RunestoneInteractive/rs/main/init_runestone.sh)
first. That wizard creates your `.env`, pulls the Docker images, starts the
stack, and initializes the database. `rsadmin` then talks to that same database
from your host.

The tools read the database URL from your environment (loaded from `.env` in the
current directory when present):

- `DEV_DBURL` — used by default.
- `DBURL` — used instead when `SERVER_CONFIG=production`.

The database must be reachable from your host. With the local `basic` compose
profile, Postgres is published on `localhost:2345`, e.g.
`DEV_DBURL=postgresql://runestone:runestone@localhost:2345/runestone_dev`.

## Install

```bash
pip install rsadmin
```

## Commands

| Command       | What it does                                                        |
|---------------|---------------------------------------------------------------------|
| `rsmanage`    | Manage the database: courses, users, instructors, books, and more.  |
| `rsmigrate`   | Run Alembic database migrations (bundled with the package).         |
| `build_books` | Rebuild and deploy every in-use PreTeXt book in the library.        |
| `build_mon`   | Textual TUI monitoring book build/deploy progress.                  |
| `tbm`         | Textual TUI watching the `traceback` table.                         |

### Running migrations

`rsmigrate` wraps Alembic and ships the migration scripts inside the package, so
it works from any directory:

```bash
rsmigrate upgrade head      # apply all pending migrations
rsmigrate current           # show the current revision
rsmigrate heads             # show the latest available revision(s)
rsmigrate downgrade -1      # roll back one revision
rsmigrate stamp head        # mark the DB as up to date without running
```

Run `rsmanage --help` (or `build_books --help`, etc.) for full usage of each
command.

> **Note:** This package does not depend on the `runestone` PyPI distribution
> (it vendors a stale, conflicting copy of `rsptx.*`). As a result, building
> legacy **RST** books is not supported here — `build_books` and
> `rsmanage build` handle **PreTeXt** books. Build RST books from a full
> Runestone source checkout instead.

## Building the wheel

From this directory:

```bash
uv build --wheel
```

Use `--wheel` (a direct wheel build), **not** a plain `uv build`. Like every
Polylith project in this repo, the wheel is assembled by force-including bricks
(and, here, the Alembic config + `migrations/` tree) from outside this project
directory. A plain `uv build` routes through an intermediate sdist that does not
contain those out-of-tree files, so it produces a broken wheel (and here fails
outright on the missing `migrations`). The repo's own `uv run build` uses
`uv build --wheel` for exactly this reason.
