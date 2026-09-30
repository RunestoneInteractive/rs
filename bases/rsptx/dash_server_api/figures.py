"""
Figures and tables shared by the visualization pages.

Both charts are one horizontal stacked bar per row whose segments add up to the
class.  The outcome chart takes the frame :func:`rsptx.question_outcomes.classify`
returns and the reading chart the one from
:func:`rsptx.question_outcomes.classify_readings`, so any page that produces
one -- a book page, an assignment -- draws it the same way.
"""

import re

import plotly.graph_objects as go
from dash import dcc, html

from rsptx.question_outcomes import (
    OUTCOME_LABELS,
    OUTCOMES,
    READING_LABELS,
    READING_STATES,
)

# The buckets are ordered, good to bad, so they are colored as a diverging
# scale: blues for correct (darker = sooner), red for never correct.  "Tried"
# has no verdict, so it takes a hue off that scale, and "never tried" is the
# neutral gray that recedes, as the midpoint of a diverging scale does.  The
# light blue and gray are under 3:1 against the page, so every value is also
# in the hover text and the table view.
OUTCOME_COLORS = {
    "first_try": "#256abf",
    "later": "#86b6ef",
    "never_correct": "#e34948",
    "tried": "#4a3aa7",
    "not_tried": "#d3d1cb",
}

# Reading progress uses the same family: done is the strong blue, part way the
# light one, and not started the receding gray.
READING_COLORS = {
    "completed": "#256abf",
    "in_progress": "#86b6ef",
    "not_started": "#d3d1cb",
}

SURFACE = "#ffffff"
INK = "#212529"
MUTED = "#666666"
GRID = "#e0e0e0"

#: Height given to each question's bar, including the gap around it.
ROW_HEIGHT = 40


#: How long an axis label may be before it is cut back to its number.
MAX_AXIS_LABEL = 24


def _short_label(label: str) -> str:
    """An axis label short enough to leave room for the bars.

    PreTeXt numbers carry the exercise title ("Exercise 5.9.1 Multiple-Choice,
    Not Randomized, One Answer."); keep through the number and drop the title.
    The full label is still in the hover and the table.
    """
    if len(label) <= MAX_AXIS_LABEL:
        return label
    m = re.match(r"^\D*\d+(?:\.\d+)*", label)
    if m and len(m.group(0)) <= MAX_AXIS_LABEL:
        return m.group(0)
    return label[: MAX_AXIS_LABEL - 1] + "…"


def _axis_labels(outcomes) -> list:
    """Short row labels, disambiguated by div_id where two would collide.

    The chart keys rows by label, so a repeated label would merge two bars.
    """
    labels = [_short_label(label) for label in outcomes["label"]]
    names = list(outcomes["name"])
    return [
        f"{label} ({name})" if labels.count(label) > 1 else label
        for label, name in zip(labels, names)
    ]


def _stacked_figure(frame, buckets, labels, colors, details, headline) -> go.Figure:
    """One horizontal stacked bar per row of ``frame``, a segment per bucket.

    :param details: per row, the text shown in parentheses after its label in
        the hover.
    :param headline: the one bucket whose segments carry a direct label.
    """
    fig = go.Figure()
    axis_labels = _axis_labels(frame)
    total = frame["students"].clip(lower=1)
    for bucket in buckets:
        counts = frame[bucket]
        if not counts.any():
            continue
        pct = (100 * counts / total).round(0)
        fig.add_trace(
            go.Bar(
                name=labels[bucket],
                y=axis_labels,
                x=counts,
                orientation="h",
                marker=dict(
                    color=colors[bucket],
                    # the 2px surface gap between stacked segments
                    line=dict(color=SURFACE, width=2),
                ),
                customdata=list(zip(pct, details, frame["label"])),
                hovertemplate=(
                    "<b>%{customdata[2]}</b> (%{customdata[1]})<br>"
                    + labels[bucket]
                    + ": %{x} students (%{customdata[0]:.0f}%)"
                    "<extra></extra>"
                ),
                # Only the headline bucket gets a direct label; the rest are in
                # the hover and the table. Plotly drops a label that won't fit.
                text=counts if bucket == headline else None,
                textposition="inside",
                insidetextanchor="middle",
                textfont=dict(color=SURFACE),
            )
        )

    fig.update_layout(
        barmode="stack",
        bargap=0.4,
        height=120 + ROW_HEIGHT * max(len(axis_labels), 1),
        margin=dict(l=10, r=20, t=40, b=40),
        plot_bgcolor=SURFACE,
        paper_bgcolor=SURFACE,
        font=dict(color=INK, size=13),
        uniformtext=dict(mode="hide", minsize=11),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.0,
            xanchor="left",
            x=0,
            traceorder="normal",
            font=dict(color=MUTED),
        ),
        xaxis=dict(
            title=dict(text="Students", font=dict(color=MUTED)),
            gridcolor=GRID,
            gridwidth=1,
            zeroline=False,
            range=[0, int(frame["students"].max() or 1)],
            tickformat=",d",
            fixedrange=True,
        ),
        yaxis=dict(
            # page order reads top to bottom
            autorange="reversed",
            categoryorder="array",
            categoryarray=axis_labels,
            fixedrange=True,
        ),
        hoverlabel=dict(bgcolor=SURFACE, font=dict(color=INK)),
    )
    return fig


def outcome_figure(outcomes) -> go.Figure:
    """How the class did on each question."""
    return _stacked_figure(
        outcomes,
        OUTCOMES,
        OUTCOME_LABELS,
        OUTCOME_COLORS,
        details=outcomes["question_type"],
        headline="first_try",
    )


def _activities(required: int) -> str:
    return f"{required} activit{'y' if required == 1 else 'ies'} required"


def reading_figure(progress) -> go.Figure:
    """How far the class has got with each reading."""
    return _stacked_figure(
        progress,
        READING_STATES,
        READING_LABELS,
        READING_COLORS,
        details=[_activities(r) for r in progress["required"]],
        headline="completed",
    )


def reading_table(progress) -> html.Table:
    """The reading chart's numbers as a table."""
    header = html.Tr(
        [
            html.Th("Reading", scope="col"),
            html.Th("Activities required", scope="col"),
        ]
        + [html.Th(READING_LABELS[s], scope="col") for s in READING_STATES]
    )
    rows = [
        html.Tr(
            [html.Th(row.label, scope="row"), html.Td(row.required)]
            + [html.Td(getattr(row, s)) for s in READING_STATES]
        )
        for row in progress.itertuples()
    ]
    return html.Table(
        [html.Thead(header), html.Tbody(rows)], className="dash-outcome-table"
    )


def outcome_table(outcomes) -> html.Table:
    """The chart's numbers as a table: the accessible, exact view."""
    header = html.Tr(
        [
            html.Th("Question", scope="col"),
            html.Th("Type", scope="col", className="dash-text"),
        ]
        + [html.Th(OUTCOME_LABELS[b], scope="col") for b in OUTCOMES]
    )
    rows = [
        html.Tr(
            [
                html.Th(row.label, scope="row"),
                html.Td(row.question_type, className="dash-text"),
            ]
            + [
                html.Td(
                    getattr(row, b)
                    if row.graded or b in ("tried", "not_tried")
                    else "—"
                )
                for b in OUTCOMES
            ]
        )
        for row in outcomes.itertuples()
    ]
    return html.Table(
        [html.Thead(header), html.Tbody(rows)], className="dash-outcome-table"
    )


def chart_block(figure, table, heading=None) -> list:
    """A chart with its table view beneath it, under an optional heading."""
    block = [] if heading is None else [html.H2(heading, className="dash-section")]
    return block + [
        dcc.Graph(
            figure=figure,
            # Zoom and pan are off, so the mode bar has nothing to offer and
            # would sit on top of the legend.
            config={"displayModeBar": False, "responsive": True},
        ),
        html.Details(
            [html.Summary("Show as a table"), table],
            className="dash-table-view",
        ),
    ]
