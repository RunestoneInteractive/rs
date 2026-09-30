"""
How the class is doing on one assignment.

``/dash/assignment-questions?assignment=<id>`` -- for each exercise, how many
students got it right on the first try, right after retrying, never right, or
never tried; for each reading, how many have completed it, are part way
through, or have not started.

When the assignment enforces its due date, only work up to the due date counts,
extended for students with a deadline exception; when late work is allowed,
everything counts.  See :mod:`rsptx.question_outcomes.assignments`.
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
from rsptx.dash_server_api.figures import (
    chart_block,
    outcome_figure,
    outcome_table,
    reading_figure,
    reading_table,
)
from rsptx.question_outcomes import (
    assignment_cutoffs,
    fetch_assignment,
    fetch_assignment_parts,
    fetch_assignments,
    fetch_roster,
    question_outcomes,
    reading_progress,
)

dash.register_page(
    __name__,
    path="/assignment-questions",
    name="Assignment progress",
    title="Assignment Progress",
    description=(
        "For each exercise in an assignment: how many students got it right on "
        "the first try, right eventually, never right, or never tried. For each "
        "reading: how many have completed it, are in progress, or have not "
        "started."
    ),
    order=2,
)


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def layout(assignment=None, **kwargs):
    context = current_context()
    with engine.connect() as conn:
        assignments = fetch_assignments(conn, context.course_id)
    # The query string gives a string; the options hold ints.
    chosen = next(
        (a["value"] for a in assignments if str(a["value"]) == assignment), None
    )
    return html.Div(
        [
            html.H1("Assignment progress"),
            html.P(
                "Choose an assignment to see how your students are doing on each "
                "of its exercises and readings. Each bar is the whole class; "
                "instructors are not counted.",
                className="dash-lede",
            ),
            dcc.Store(id="ap-course", data=sign_course(context)),
            dcc.Store(id="ap-query-names", data=["assignment"]),
            dcc.Store(id="ap-query-synced"),
            dcc.Store(id="ap-request"),
            html.Div(
                [
                    html.Div(
                        [
                            html.Label("Assignment", htmlFor="ap-assignment"),
                            dcc.Dropdown(
                                id="ap-assignment",
                                options=assignments,
                                value=chosen,
                                placeholder="Choose an assignment",
                                clearable=False,
                            ),
                        ],
                        className="dash-field",
                    ),
                    html.Div(
                        [
                            html.Button(
                                "Refresh",
                                id="ap-refresh",
                                type="button",
                                className="btn btn-secondary",
                            ),
                            html.Span(id="ap-updated", className="dash-updated"),
                        ],
                        className="dash-actions",
                    ),
                ],
                className="dash-filters",
            ),
            html.P(id="ap-status", role="status", className="dash-status"),
            html.Div(id="ap-results"),
        ]
    )


# Keep the selection in the URL so a reload keeps it; see assets/dash.js.
dash.clientside_callback(
    ClientsideFunction(namespace="rs", function_name="syncQuery"),
    Output("ap-query-synced", "data"),
    Input("ap-assignment", "value"),
    State("ap-query-names", "data"),
)

dash.clientside_callback(
    ClientsideFunction(namespace="rs", function_name="updatedAt"),
    Output("ap-updated", "children"),
    Input("ap-results", "children"),
)


@callback(
    Output("ap-request", "data"),
    Input("ap-assignment", "value"),
    Input("ap-refresh", "n_clicks"),
)
def request_chart(assignment_id, refreshes):
    """Turn "an assignment was chosen" or "Refresh" into a chart request.

    Kept out of the background callback so an empty selection costs no Celery
    job; ``refreshes`` makes every press of Refresh a new request.
    """
    if assignment_id is None:
        return no_update
    return {"assignment": assignment_id, "n": refreshes}


def _policy(assignment, extended: int) -> html.P:
    """One line saying which work counts."""
    if not assignment.enforce_due:
        text = "Late work is allowed for this assignment, so all work counts."
    else:
        text = "Work after the due date is not counted."
        if extended:
            text += (
                f" {_plural(extended, 'student')} "
                f"{'has' if extended == 1 else 'have'} an extension, "
                "which is applied."
            )
    return html.P(text, className="dash-policy")


@callback(
    Output("ap-results", "children"),
    Input("ap-request", "data"),
    State("ap-course", "data"),
    background=True,
    running=[
        (Output("ap-status", "children"), "Counting work…", ""),
        (Output("ap-assignment", "disabled"), True, False),
        (Output("ap-refresh", "disabled"), True, False),
    ],
    prevent_initial_call=True,
)
def build_charts(request, course_token):
    """Runs in the Celery worker; the course comes from the signed token."""
    if not request:
        raise PreventUpdate
    context = verify_course(course_token)
    with engine.connect() as conn:
        # Scoped to the signed course, so an edited id cannot reach another
        # course's assignment.
        assignment = fetch_assignment(conn, context.course_id, request["assignment"])
        if assignment is None:
            return html.P("That assignment is not in your course.")
        exercises, readings = fetch_assignment_parts(conn, assignment.id)
        if not (exercises or readings):
            return html.P("This assignment has no exercises or readings yet.")
        roster = fetch_roster(conn, context.course_name)
        cutoffs, extended = assignment_cutoffs(
            conn, context.course_id, assignment, roster
        )
        outcomes = (
            question_outcomes(
                conn,
                context.course_name,
                context.base_course,
                exercises,
                cutoffs,
                roster,
            )
            if exercises
            else None
        )
        progress = (
            reading_progress(
                conn,
                context.course_name,
                context.base_course,
                readings,
                roster,
                cutoffs,
            )
            if readings
            else None
        )

    parts = []
    if exercises:
        parts.append(_plural(len(exercises), "exercise"))
    if readings:
        parts.append(_plural(len(readings), "reading"))
    results = [
        html.P(
            " · ".join(parts + [f"{_plural(len(roster), 'student')} enrolled"]),
            className="dash-summary",
        ),
        _policy(assignment, extended),
    ]
    if outcomes is not None:
        results += chart_block(
            outcome_figure(outcomes), outcome_table(outcomes), heading="Exercises"
        )
    if progress is not None:
        results += chart_block(
            reading_figure(progress), reading_table(progress), heading="Readings"
        )
    return results
