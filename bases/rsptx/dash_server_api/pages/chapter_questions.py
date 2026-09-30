"""
How the class did on each question on one page of the book.

``/dash/chapter-questions`` -- choose a chapter and subchapter; the chart shows,
for every question on that page, how many students got it right on the first
try, right after retrying, never right, or never tried.

The selection is kept in the query string (``?chapter=<label>&subchapter=<label>``),
so reloading the page, bookmarking it or sharing the link brings the same chart
back.  The Refresh button recounts the current selection.
"""

import dash
from dash import (
    ClientsideFunction,
    Input,
    Output,
    State,
    callback,
    dcc,
    html,
    no_update,
)
from dash.exceptions import PreventUpdate

from rsptx.dash_server_api.auth import current_context, sign_course, verify_course
from rsptx.dash_server_api.db import engine
from rsptx.dash_server_api.figures import outcome_figure, outcome_table
from rsptx.question_outcomes import (
    fetch_chapters,
    fetch_subchapter_questions,
    fetch_subchapters,
    question_outcomes,
)

dash.register_page(
    __name__,
    path="/chapter-questions",
    name="Question outcomes by page",
    title="Question Outcomes by Page",
    description=(
        "For each question on a page of the book: how many students got it "
        "right on the first try, right eventually, never right, or never tried."
    ),
    order=1,
)


def layout(chapter=None, subchapter=None, **kwargs):
    context = current_context()
    with engine.connect() as conn:
        chapters = fetch_chapters(conn, context.base_course)
        subchapters = (
            fetch_subchapters(conn, context.base_course, chapter) if chapter else []
        )
    if subchapter not in {s["value"] for s in subchapters}:
        subchapter = None
    return html.Div(
        [
            html.H1("Question outcomes by page"),
            html.P(
                "Choose a page of the book to see how your students did on each "
                "of its questions. Each bar is the whole class; answers from "
                "instructors are not counted.",
                className="dash-lede",
            ),
            dcc.Store(id="qo-course", data=sign_course(context)),
            # The query-string names for the dropdowns, in callback order.
            dcc.Store(id="qo-query-names", data=["chapter", "subchapter"]),
            dcc.Store(id="qo-query-synced"),
            dcc.Store(id="qo-request"),
            html.Div(
                [
                    html.Div(
                        [
                            html.Label("Chapter", htmlFor="qo-chapter"),
                            dcc.Dropdown(
                                id="qo-chapter",
                                options=chapters,
                                value=chapter,
                                placeholder="Choose a chapter",
                                clearable=False,
                            ),
                        ],
                        className="dash-field",
                    ),
                    html.Div(
                        [
                            html.Label("Section", htmlFor="qo-subchapter"),
                            dcc.Dropdown(
                                id="qo-subchapter",
                                options=subchapters,
                                value=subchapter,
                                placeholder="Choose a section",
                                clearable=False,
                            ),
                        ],
                        className="dash-field",
                    ),
                    html.Div(
                        [
                            html.Button(
                                "Refresh",
                                id="qo-refresh",
                                type="button",
                                className="btn btn-secondary",
                            ),
                            html.Span(id="qo-updated", className="dash-updated"),
                        ],
                        className="dash-actions",
                    ),
                ],
                className="dash-filters",
            ),
            html.P(id="qo-status", role="status", className="dash-status"),
            html.Div(id="qo-results"),
        ]
    )


@callback(
    Output("qo-subchapter", "options"),
    Output("qo-subchapter", "value"),
    Input("qo-chapter", "value"),
    prevent_initial_call=True,
)
def load_subchapters(chapter):
    if not chapter:
        return [], None
    with engine.connect() as conn:
        return fetch_subchapters(conn, current_context().base_course, chapter), None


# Keep the selection in the URL so a reload keeps it; see assets/dash.js.
dash.clientside_callback(
    ClientsideFunction(namespace="rs", function_name="syncQuery"),
    Output("qo-query-synced", "data"),
    Input("qo-chapter", "value"),
    Input("qo-subchapter", "value"),
    State("qo-query-names", "data"),
)

dash.clientside_callback(
    ClientsideFunction(namespace="rs", function_name="updatedAt"),
    Output("qo-updated", "children"),
    Input("qo-results", "children"),
)


@callback(
    Output("qo-request", "data"),
    Output("qo-results", "children", allow_duplicate=True),
    Input("qo-subchapter", "value"),
    Input("qo-refresh", "n_clicks"),
    State("qo-chapter", "value"),
    prevent_initial_call="initial_duplicate",
)
def request_chart(subchapter, refreshes, chapter):
    """Turn "a section was chosen" or "Refresh was pressed" into a chart request.

    Kept out of the background callback so an incomplete selection costs no
    Celery job -- and doesn't lock the dropdowns while one runs. ``refreshes``
    is part of the request so pressing Refresh always makes a new one.
    """
    if not (chapter and subchapter):
        # Changing the chapter clears the section; don't leave the old
        # section's chart up under the new chapter's name. The request is left
        # alone: setting it at all would start a job.
        return no_update, []
    return {"chapter": chapter, "subchapter": subchapter, "n": refreshes}, no_update


@callback(
    Output("qo-results", "children"),
    Input("qo-request", "data"),
    State("qo-course", "data"),
    background=True,
    running=[
        (Output("qo-status", "children"), "Counting answers…", ""),
        (Output("qo-chapter", "disabled"), True, False),
        (Output("qo-subchapter", "disabled"), True, False),
        (Output("qo-refresh", "disabled"), True, False),
    ],
    cancel=[Input("qo-chapter", "value")],
    prevent_initial_call=True,
)
def build_chart(request, course_token):
    """Runs in the Celery worker; the course comes from the signed token."""
    if not request:
        raise PreventUpdate
    chapter, subchapter = request["chapter"], request["subchapter"]
    context = verify_course(course_token)
    with engine.connect() as conn:
        questions = fetch_subchapter_questions(
            conn, context.base_course, chapter, subchapter
        )
        if not questions:
            return html.P("There are no questions on this page.")
        outcomes = question_outcomes(
            conn, context.course_name, context.base_course, questions
        )
    students = int(outcomes["students"].iloc[0])
    return [
        html.P(
            f"{len(questions)} question{'s' if len(questions) != 1 else ''} · "
            f"{students} student{'s' if students != 1 else ''} enrolled",
            className="dash-summary",
        ),
        dcc.Graph(
            figure=outcome_figure(outcomes),
            # Zoom and pan are off, so the mode bar has nothing to offer
            # and would sit on top of the legend.
            config={"displayModeBar": False, "responsive": True},
        ),
        html.Details(
            [html.Summary("Show as a table"), outcome_table(outcomes)],
            className="dash-table-view",
        ),
    ]
