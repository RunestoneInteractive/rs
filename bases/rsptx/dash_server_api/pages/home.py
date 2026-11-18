"""The index of visualizations, at ``/dash/``."""

import dash
from dash import dcc, html

dash.register_page(__name__, path="/", title="Instructor Visualizations")


def layout(**kwargs):
    pages = [
        p
        for p in dash.page_registry.values()
        if p["path"] != "/" and p.get("description")
    ]
    return html.Div(
        [
            html.H1("Instructor Visualizations"),
            html.Ul(
                [
                    html.Li(
                        [
                            dcc.Link(p["name"], href=p["relative_path"]),
                            html.P(p["description"]),
                        ]
                    )
                    for p in sorted(pages, key=lambda p: p.get("order") or 0)
                ],
                className="dash-page-list",
            ),
        ]
    )
