"""
Figures and tables shared by the visualization pages.

The outcome chart takes the frame :func:`rsptx.question_outcomes.classify`
returns, so any page that produces one -- a book page, an assignment -- draws
it the same way.
"""

import re

import plotly.graph_objects as go
from dash import html

from rsptx.question_outcomes import OUTCOME_LABELS, OUTCOMES

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


def outcome_figure(outcomes) -> go.Figure:
    """One horizontal stacked bar per question, segments summing to the class."""
    fig = go.Figure()
    labels = _axis_labels(outcomes)
    total = outcomes["students"].clip(lower=1)
    for bucket in OUTCOMES:
        counts = outcomes[bucket]
        if not counts.any():
            continue
        pct = (100 * counts / total).round(0)
        fig.add_trace(
            go.Bar(
                name=OUTCOME_LABELS[bucket],
                y=labels,
                x=counts,
                orientation="h",
                marker=dict(
                    color=OUTCOME_COLORS[bucket],
                    # the 2px surface gap between stacked segments
                    line=dict(color=SURFACE, width=2),
                ),
                customdata=list(zip(pct, outcomes["question_type"], outcomes["label"])),
                hovertemplate=(
                    "<b>%{customdata[2]}</b> (%{customdata[1]})<br>"
                    + OUTCOME_LABELS[bucket]
                    + ": %{x} students (%{customdata[0]:.0f}%)"
                    "<extra></extra>"
                ),
                # Only the headline bucket gets a direct label; the rest are in
                # the hover and the table. Plotly drops a label that won't fit.
                text=counts if bucket == "first_try" else None,
                textposition="inside",
                insidetextanchor="middle",
                textfont=dict(color=SURFACE),
            )
        )

    fig.update_layout(
        barmode="stack",
        bargap=0.4,
        height=120 + ROW_HEIGHT * max(len(labels), 1),
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
            range=[0, int(outcomes["students"].max() or 1)],
            tickformat=",d",
            fixedrange=True,
        ),
        yaxis=dict(
            # page order reads top to bottom
            autorange="reversed",
            categoryorder="array",
            categoryarray=labels,
            fixedrange=True,
        ),
        hoverlabel=dict(bgcolor=SURFACE, font=dict(color=INK)),
    )
    return fig


def outcome_table(outcomes) -> html.Table:
    """The chart's numbers as a table: the accessible, exact view."""
    header = html.Tr(
        [html.Th("Question", scope="col"), html.Th("Type", scope="col")]
        + [html.Th(OUTCOME_LABELS[b], scope="col") for b in OUTCOMES]
    )
    rows = [
        html.Tr(
            [
                html.Th(row.label, scope="row"),
                html.Td(row.question_type),
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
