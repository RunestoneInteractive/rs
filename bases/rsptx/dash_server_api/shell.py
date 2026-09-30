"""
The page shell around every dash page: the site's navbar and footer.

These are the admin server's own ``_navbar.html`` and ``footer.html``, rendered
here with Jinja rather than copied, so the dash pages cannot drift from the rest
of the site.  They are rendered into the HTML Dash serves for each page load --
the one request that carries the instructor's login -- outside the React tree
Dash manages.
"""

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import jinja2
from dash import Dash
from flask import g

from rsptx.configuration import settings


def _template_folder() -> Path:
    """Where the shared templates live, found without importing the package.

    Importing ``rsptx.templates`` runs its ``__init__``, which imports FastAPI;
    ``find_spec`` locates a subpackage without executing it.
    """
    spec = importlib.util.find_spec("rsptx.templates")
    return Path(next(iter(spec.submodule_search_locations)))


_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(_template_folder()),
    autoescape=jinja2.select_autoescape(["html"]),
)


def _render(template: str) -> str:
    """A shared template for the instructor making this request."""
    context = getattr(g, "rs_context", None)
    if context is None:
        return ""
    return _env.get_template(template).render(
        user=SimpleNamespace(username=context.username),
        course=SimpleNamespace(course_name=context.course_name),
        # Only instructors get this far; see auth.require_instructor.
        is_instructor=True,
        student_page=False,
        settings=settings,
        navitems="",
    )


def render_navbar() -> str:
    """The site navbar."""
    return _render("_navbar.html")


def render_footer() -> str:
    """The site footer."""
    return _render("footer.html")


#: Dash's default page, with ``lang`` set as ``_base.html`` sets it, and its
#: scripts in a plain div: Dash wraps them in a ``<footer>``, which would give
#: screen readers a second, empty footer landmark beside the site's.
INDEX_STRING = """<!DOCTYPE html>
<html lang="en">
    <head>
        {%metas%}
        <title>{%title%}</title>
        {%favicon%}
        {%css%}
    </head>
    <body>
        {%app_entry%}
        <div>
            {%config%}
            {%scripts%}
            {%renderer%}
        </div>
    </body>
</html>"""


class RunestoneDash(Dash):
    """A Dash app whose pages sit between the site navbar and footer."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("index_string", INDEX_STRING)
        super().__init__(*args, **kwargs)

    def interpolate_index(self, **kwargs):
        kwargs["app_entry"] = (
            render_navbar() + kwargs.get("app_entry", "") + render_footer()
        )
        return super().interpolate_index(**kwargs)
