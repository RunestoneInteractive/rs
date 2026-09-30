"""
The instructor visualization server.

A Dash multi-page app served under ``/dash/``.  Each visualization is a page in
``pages/`` with its own route; slow work runs in background callbacks executed
by a Celery worker, so a large class never ties up a web worker or hits an HTTP
timeout.

Run the web process with ``gunicorn rsptx.dash_server_api.core:server`` and the
worker with ``celery -A rsptx.dash_server_api.core:celery_app worker -Q dash``.
Both import this module, which is what registers the callbacks in each.
"""

import os
from pathlib import Path

import dash
from celery import Celery
from celery.signals import worker_process_init
from dash import CeleryManager, Dash, dcc, html

from rsptx.dash_server_api.auth import require_instructor
from rsptx.dash_server_api.db import engine

URL_BASE = "/dash/"

# The author server's worker listens on the default "celery" queue of the same
# broker; a separate queue keeps each worker to its own tasks.
CELERY_QUEUE = "dash"

celery_app = Celery(
    __name__,
    broker=os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0"),
)
celery_app.conf.task_default_queue = CELERY_QUEUE


@worker_process_init.connect
def _fresh_pool(**kwargs):
    """Drop connections inherited from the parent of a forked Celery worker."""
    engine.dispose(close=False)


# Results are fetched by the page within seconds of finishing; an hour is
# plenty for a slow poll and keeps Redis from filling with old figures.
background_manager = CeleryManager(celery_app, expire=3600)

app = Dash(
    __name__,
    url_base_pathname=URL_BASE,
    use_pages=True,
    pages_folder=str(Path(__file__).parent / "pages"),
    background_callback_manager=background_manager,
    external_stylesheets=["/staticAssets/css/rs-core.css"],
    title="Runestone Instructor Visualizations",
    update_title=None,
    suppress_callback_exceptions=True,
)

# Exposed for gunicorn.
server = app.server
server.before_request(lambda: require_instructor(URL_BASE))

app.layout = html.Div(
    [
        html.Header(
            html.Nav(
                [
                    html.A("Instructor menu", href="/admin/instructor/menu"),
                    html.Span(" / "),
                    dcc.Link("Visualizations", href=URL_BASE),
                ],
                **{"aria-label": "Breadcrumb"},
            ),
            className="dash-header",
        ),
        html.Main(dash.page_container, className="dash-main"),
    ]
)
