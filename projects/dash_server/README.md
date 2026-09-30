# The Instructor Visualization Server

Instructor-facing visualizations built with [Dash](https://dash.plotly.com/),
served under `/dash/`. Each visualization is a page in
`bases/rsptx/dash_server_api/pages/` with its own route. Anything slow runs as a
Dash *background callback*, which a Celery worker executes, so a large class
never ties up a web worker or hits an HTTP timeout.

The data layer is the `rsptx.question_outcomes` component; it depends only on
SQLAlchemy and pandas, so this server does not carry the async database stack.

Two compose services run from this one image:

* `dash` -- the web process: `gunicorn rsptx.dash_server_api.core:server`
* `dash_worker` -- the background callbacks:
  `celery -A rsptx.dash_server_api.core:celery_app worker -Q dash`

The worker listens on its own `dash` queue so it never takes the author
server's tasks off the shared Redis broker.

Every request must carry the `access_token` cookie from the admin server's
login, for a user who is an instructor in their current course.

## Build

```bash
uv run build -s dash -s dash_worker full
```

## Run locally without Docker

With Redis on localhost and `DEV_DBURL` set:

```bash
uv run gunicorn rsptx.dash_server_api.core:server --bind 0.0.0.0:8116 --reload
uv run celery -A rsptx.dash_server_api.core:celery_app worker -Q dash
```
