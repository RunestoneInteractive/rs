# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, Copilot, ...) working in
this repository. Human contributors may find it useful too; the full developer docs
are in `docs/source/` (start with `developing.rst`).

Keep this file short. Add a trap here only when an agent or reviewer actually hit it,
and put anything specific to one directory in that directory's `AGENTS.md` instead.

## Project overview

Runestone Academy is a Python monorepo using a **polylith architecture** to build and
serve interactive educational textbooks. It runs as Docker-based microservices: FastAPI
servers on top of shared components.

**Polylith layers:**
- `components/rsptx/` — shared business logic: `db`, `auth`, `validation`, `logging`,
  `grading_helpers`, `lti1p3`, `configuration`, `templates`, ...
- `bases/rsptx/` — server implementations: `book_server_api`, `assignment_server_api`,
  `author_server_api`, `admin_server_api`, `dash_server_api`, `interactives`, `rsmanage`
- `projects/` — one deployable Docker service per server

When adding functionality, decide first whether it belongs in a shared component or a
service-specific base.

**Services:**
| Service | Port | Notes |
|---------|------|-------|
| caddy | 80, 443 | Default entry point. nginx is an alternative; both bind port 80 |
| book | 8111 | FastAPI, serves book content and logs/grades student answers |
| assignment | 8113 | FastAPI, assignments, grader, assignment builder (React) |
| author | 8114 | FastAPI + Celery |
| admin | 8115 | FastAPI: auth, instructor UI, LTI, and the catch-all front door |
| dash / dash_worker | 8116 | Dash (Flask) instructor visualizations at `/dash/` |
| db | 2345 | PostgreSQL (`basic` profile only) |
| redis | 6379 | Cache + Celery broker |

**Database:**
- Models in `components/rsptx/db/models.py` (SQLAlchemy 2.0, async); CRUD functions in
  `components/rsptx/db/crud/`
- Migrations in `migrations/versions/` via Alembic
- `DEV_DBURL` for processes on the host, `DC_DEV_DBURL` for Docker containers.
  `DEV_DBURL` is often exported from the shell profile rather than set in `.env`, so
  read it from the environment.

## Directory guides

Read these before changing code in those directories:
- `bases/rsptx/interactives/AGENTS.md` — the JavaScript components embedded in books
- `bases/rsptx/assignment_server_api/assignment_builder/AGENTS.md` — the React
  assignment builder and grader
- `components/rsptx/db/AGENTS.md` — models, migrations, and CRUD functions
- `components/rsptx/grading_helpers/AGENTS.md` — how student answers become grades
- `components/rsptx/templates/AGENTS.md` — Jinja templates and shared static assets

## Common commands

This repo uses [uv](https://docs.astral.sh/uv/).

```bash
uv sync                                 # create .venv, install all dependency groups
cp sample.env .env                      # then edit BOOK_PATH and DB URLs
uv run build env                        # check required env vars

uv run build full                       # wheels + images + restart
uv run build -s <service> dev           # rebuild and restart one service
uv run build --core dev                 # rebuild the core services -- useful when doing dev
docker compose --profile basic up       # run with a local DB
docker compose down                     # keeps DB data; `down -v` destroys it
```

`-s` takes the **docker-compose service key** (`book`, `admin`, `assignment`,
`author`, ...), not the `projects/` directory name. `-s book_server` prints success but
builds nothing.

### Tests

```bash
SERVER_CONFIG=test uv run pytest                       # all Python tests
SERVER_CONFIG=test uv run pytest -k test_poll          # by name
SERVER_CONFIG=test uv run pytest test/components/rsptx/db/

# JavaScript component tests (vitest + jsdom), from bases/rsptx/interactives/
npm test
npx vitest run runestone/activecode/test/activecode.test.js
```

Python tests live under `test/`, mirroring `bases/` and `components/`. JS tests live in
`runestone/<component>/test/*.test.js`; see the Unit tests section of
`docs/source/javascript_feature.rst`. Tests for jQuery-free components must not import
`test-support/jquery-globals.js`.

### Database

```bash
alembic revision --autogenerate -m "description"   # after editing models.py
alembic upgrade head
uv run build checkdb                               # migration status
```

Always read the generated migration before applying it; autogenerate misses some
changes and adds spurious ones.

### Code quality

```bash
black .            # Python formatting (the build fails without it)
flake8             # Python linting
npm run prettier   # JavaScript formatting
```

## Traps

None of these are visible from the code alone.

**Testing**
- Tests refuse to run when `SERVER_CONFIG` is set to anything but `test` (unset is
  fine). Development shells usually set it to `development`, hence the prefix above.
- Run only **one** pytest session against the test DB at a time. The `init_test_db`
  fixture drops and recreates tables; a second run's open transaction blocks it with
  no timeout, which looks like an unrelated test hanging.
- A new async test module that uses no session-scoped fixture must declare
  `pytestmark = pytest.mark.asyncio(loop_scope="session")`. Without it, every DB test
  that runs *after* it fails with "attached to a different loop", and the new module
  looks innocent.

**Running and verifying**
- Code changes don't reach the running app until the service is rebuilt
  (`uv run build -s <service> dev`). Shared static files under
  `components/rsptx/templates/staticAssets` are baked into the **caddy** image, so
  rebuild caddy for those too.
- Caddy is the default proxy. Any routing change in `projects/nginx/` must be mirrored
  into `projects/caddy/Caddyfile`, or it won't take effect in most deployments.
- The only login is `/admin/auth/login`.

**Cross-server links and auth**
- In production the author server runs on a **separate host**. A root-relative
  `/author/...` link works locally (one proxy serves everything) but breaks in
  production. Cross-server URLs must come from a setting in
  `components/rsptx/configuration/core.py` that an env var can override; see
  `author_server_url`.
- The `access_token` cookie is set by both FastAPI (`components/rsptx/auth/session.py`)
  and the legacy web2py server, and both must use the same scope. Delete it only
  through `auth_manager.delete_cookie(response)`; a delete whose scope differs from the
  set silently leaves the user logged in.

**Templates and times**
- Datetimes are stored as naive **UTC**. Render them with the `course_datetime_tag()`
  Jinja global, never `strftime`, and add
  `{% include 'common/localize_times.html' %}` to **each page** that uses it. Don't move
  that include into `_base.html`: PreTeXt books ship their own `_base.html`, and the
  include would silently vanish for those courses.
- `json.dumps()` output inside a `<script>` tag needs `| safe`, or Jinja HTML-escapes it.

**Releases**
- JavaScript in `bases/rsptx/interactives/` ships from `main` to PreTeXt books. RST
  (Sphinx) books get their JS from the `runestone` PyPI package, which is released
  from the `legacy_support` branch. A JS fix merged to `main` does not reach RST books
  until it is also ported there.

## Common issues

- **DB connection errors**: check that the DB URL variables match your setup.
- **Out-of-sync migrations**: run `alembic stamp head` after a fresh DB setup.
- **Docker build failures**: check `build.log` in the project directory.
- **Missing env vars**: run `uv run build env`.
