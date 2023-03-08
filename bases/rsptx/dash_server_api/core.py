# Run this app with `python app.py` and
# visit http://127.0.0.1:8050/ in your web browser.
# See - https://dash.plotly.com/layout for the docs getting started
# Most of what we want to do will probably involve "long callbacks" https://dash.plotly.com/long-callbacks
# this will avoid http timeouts

import dash
from dash import Dash, html, dcc
from dash.long_callback import DiskcacheLongCallbackManager
from dash.dependencies import Input, Output
import diskcache
import plotly.express as px
import pandas as pd
from sqlalchemy import create_engine
import dash_bootstrap_components as dbc
from plotly.subplots import make_subplots
import math
import os

cache = diskcache.Cache("./cache")
long_callback_manager = DiskcacheLongCallbackManager(cache)

app = Dash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP])
# We expose the server object so we can run this app under gunicorn.
server = app.server

# TODO: eliminate these globals after testing
COURSE = "Win21-SI206"
BASE = "py4e-int"

colors = {"background": "#111111", "text": "#7FDBFF"}

DBURL = os.environ["DEV_DBURL"]

ALL_STUDENTS = pd.read_sql_query(
    f"""select username, first_name, last_name
from user_courses join auth_user on user_id = auth_user.id join courses on user_courses.course_id = courses.id
where courses.course_name = '{COURSE}'
""",
    DBURL,
)


def row_col_gen(num_items, cols=2):
    rows = math.ceil(num_items / 2)
    for i in range(1, rows + 1):
        for j in range(1, cols + 1):
            yield tuple([i, j])


def get_chapters():
    # since the various chart creating things are asynchronous each needs their own engine.
    # There must be a better way than creating and disposing of an engine.  But I'll need
    # to do more research
    eng = create_engine(DBURL)

    chap_data = pd.read_sql_query
    res = pd.read_sql_query(
        f"""
    select chapter_name as label, chapter_label as value from chapters
    where course_id = '{BASE}' and chapter_num < 999
    order by chapter_num
    """,
        eng,
    )

    return res.to_dict(orient="records")


#
# Chapter / SubChapter progress
#


@dash.callback(
    output=Output("chapter-progress-graph", "figure"),
    inputs=Input("chapter_list", "value"),
    background=True,
    manager=long_callback_manager,
)
def do_callback(chap_label):
    return make_progress_graph(chap_label)


def make_short_name(name):
    if len(name) < 30:
        return name
    else:
        return name[:15] + "..." + name[-12:]


def make_progress_graph(chapter):
    eng = create_engine(DBURL)

    progress = pd.read_sql_query(
        f"""select sub_chapter_id, status, count(*)
    from user_sub_chapter_progress
    where course_name = '{COURSE}' and chapter_id = '{chapter}'
    group by sub_chapter_id, status
    order by sub_chapter_id""",
        eng,
    )
    chap_subchap = pd.read_sql_query(
        f"""select chapter_label, sub_chapter_label, sub_chapter_name, sub_chapter_num
    from chapters join sub_chapters on chapters.id = sub_chapters.chapter_id
    where course_id = '{BASE}'""",
        eng,
    )

    scdf = progress.groupby("sub_chapter_id").agg(total=("count", "sum"))
    pdf = progress.groupby(["sub_chapter_id", "status"]).agg(
        students=("count", "sum"), ccount=("count", "min")
    )
    pdf = pdf.reset_index()
    pdf["pct"] = pdf.apply(
        lambda row: row.students / scdf.loc[row.sub_chapter_id], axis=1
    )
    smap = {-1: "Not Started", 0: "Started", 1: "Complete"}
    pdf["named_status"] = pdf.status.map(lambda x: smap[x])
    pdf = pdf.merge(
        chap_subchap[chap_subchap.chapter_label == chapter],
        left_on="sub_chapter_id",
        right_on="sub_chapter_label",
    )
    pdf = pdf[pdf.sub_chapter_num > 0].sort_values("sub_chapter_num", ascending=True)
    pdf["short_name"] = pdf.sub_chapter_name.map(make_short_name)

    # assume you have a "long-form" data frame
    # see https://plotly.com/python/px-arguments/ for more options

    fig = px.bar(
        pdf,
        x="pct",
        y="short_name",
        color="named_status",
        width=700,
        height=1000,
        category_orders={"short_name": pdf.short_name.unique()},
    )

    fig.update_layout(
        plot_bgcolor=colors["background"],
        paper_bgcolor=colors["background"],
        font_color=colors["text"],
    )
    return fig


#
# Student Activity Summary
#
# This callback takes a bit of getting used to
# `output` contains the id of a thing in the page layout that will be replaced as a result of the
# callback. It is a figure.
# The `input` Hooks this up to one or more input elements.  For example a dropdown or button,
# For traditional html input methods you would typically want the value but some elements created by
# Dash have special values such as n_clicks for a button.
# the manager is typically a celery/redis thing in production but for development it is easy to use diskcache.
#
@dash.callback(
    output=Output("student-progress-graph", "figure"),
    inputs=Input("chapter_list", "value"),
    background=True,
    manager=long_callback_manager,
)
def do_callback(chap_label):
    return make_student_activity_graph(chap_label)


def make_student_activity_graph(chap):
    eng = create_engine(DBURL)

    sa = pd.read_sql_query(
        f"""
    select sid, Etype, count(*) from (
    select sid,
      case
        when event = 'page' then 'Page View'
        when event = 'activecode' then 'Run Program'
        else 'Other'
      end as EType
    from useinfo where course_id = '{COURSE}' ) as T
    where sid not in (select username from auth_user join course_instructor on auth_user.id = instructor )
    group by sid, EType
    order by sid
    """,
        eng,
    )
    sa = sa[sa.sid.str.contains("@") == False]
    # sa["is_instructor"] = sa.sid.map(lambda x: x in ALL_STUDENTS.username.values)
    # sa = sa[sa.is_instructor == False]
    fig = px.bar(sa, x="count", y="sid", color="etype", width=700, height=1200)

    return fig


#
# Donut Charts by subchapter
#
@app.callback(Output("subchapter_list", "options"), Input("chapter_list", "value"))
def make_subchapter_options(selected_chapter):
    # select all subchapters for the given chapter in the BASECOURSE
    res = pd.read_sql_query(
        f"""
    select sub_chapter_name as label, sub_chapter_label as value
        from sub_chapters join chapters on chapter_id = chapters.id
        where chapters.course_id = '{BASE}'
            and chapters.chapter_label = '{selected_chapter}'
            and sub_chapter_num != 999
            and sub_chapter_num != 0
        order by sub_chapter_num""",
        DBURL,
    )

    res = res.to_dict(orient="records")
    return res


# Now we need another callbackk that uses the output of the selected chapter and
# subchapter so that we can generate the donut charts.
@app.callback(
    Output("bag_of_donuts", "figure"),
    Input("chapter_list", "value"),
    Input("subchapter_list", "value"),
)
def make_the_donuts(chapter, subchapter):
    # note pass makes the entire page unresponsive I guess since it does not supply
    # the required output...
    eng = create_engine(DBURL)

    answer_tables = [
        "clickablearea_answers",
        "dragndrop_answers",
        "fitb_answers",
        "mchoice_answers",
        "parsons_answers",
        "unittest_answers",
    ]
    all_answers = []

    for tbl in answer_tables:
        all_answers.append(
            pd.read_sql_query(
                f"""select div_id, sid, correct, count(*), min({tbl}.timestamp)
        from {tbl} join questions on div_id = questions.name
            and questions.base_course = '{BASE}'
            and questions.from_source = 'T'
        where course_name = '{COURSE}'
            and chapter = '{chapter}'
            and subchapter = '{subchapter}'
        group by div_id, sid, correct
        order by div_id, sid
    """,
                eng,
            )
        )

    student_work = pd.concat(all_answers)

    sun = student_work.set_index(["sid", "div_id", "correct"]).unstack(
        level=["correct"]
    )

    sun = sun.reset_index()

    sun.columns = sun.columns.map("_".join)
    sun = sun.rename(
        columns={
            "min_F": "first_incorrect",
            "min_T": "first_correct",
            "div_id_": "div_id",
            "sid_": "sid",
            "count_F": "num_incorrect",
            "count_T": "num_correct",
        }
    )

    tot_students = len(ALL_STUDENTS) - 1
    try:
        sun["right_first"] = sun.apply(
            lambda row: row.first_correct < row.first_incorrect
            or pd.isnull(row.first_incorrect),
            axis=1,
        )
    except:
        return {}

    sun["multiple_tries"] = sun.apply(
        lambda row: row.first_correct > row.first_incorrect, axis=1
    )

    sun["gave_up"] = sun.apply(lambda row: pd.isnull(row.first_correct), axis=1)

    sung = sun.groupby("div_id").agg(
        stopped=("gave_up", "sum"),
        multiple_attempts=("multiple_tries", "sum"),
        first_attempt=("right_first", "sum"),
    )

    sung["no_attempt"] = sung.apply(
        lambda row: tot_students
        - (row.stopped + row.multiple_attempts + row.first_attempt),
        axis=1,
    )

    sung = sung.reset_index()

    sungm = sung.melt(id_vars=["div_id"])
    sungm = sungm.sort_values(["variable", "div_id"])

    cols = 2
    num_rows = math.ceil(sungm.div_id.nunique())
    fig = make_subplots(
        rows=num_rows,
        cols=cols,
        specs=[[{"type": "domain"} for x in range(cols)] for y in range(num_rows)],
    )

    positions = row_col_gen(sungm.div_id.nunique())
    for did in sungm.div_id.unique():
        row, col = next(positions)
        df = sungm[sungm.div_id == did]
        values = df.value
        names = df.variable
        fig.add_pie(
            values=values,
            hole=0.4,
            labels=names,
            sort=False,  # If True plotly re-sorts the categories larges to smallest
            title={
                "text": f"<a href='https://runestone.academy'>{did}</a>",
                "position": "bottom center",
            },
            row=row,
            col=col,
        )

    fig.update_layout(height=250 * num_rows, width=600)
    fig.update_layout(colorway=["blue", "orange", "lightgray", "red"])

    # if there is a really large number of donuts maybe remove the text
    # fig.update_traces(textinfo="none")
    return fig


# This layout describes the page.  There is no html and no template, just this.
# Under the hood Dash generates the required html/css/javascript using React.
#
app.layout = html.Div(
    children=[
        html.Div(
            [
                dbc.Row(
                    [
                        dbc.Col(
                            children=[
                                html.H1(
                                    children="Student Progress",
                                    style={
                                        "textAlign": "center",
                                        "color": colors["text"],
                                    },
                                ),
                                """Chapter Progress""",
                                dcc.Dropdown(
                                    id="chapter_list",
                                    options=get_chapters(),
                                    value="intro",
                                ),
                                dcc.Graph(id="chapter-progress-graph"),
                            ],
                            style={"width": "48%"},
                        ),
                        dbc.Col(
                            children=[
                                """Student Progress""",
                                dcc.Graph(id="student-progress-graph"),
                            ],
                            style={"width": "48%"},
                        ),
                    ]
                ),
                # Here begins the donut chart section...
                # This adds a bunch of complexity now because we want the chapter dropdown to cause
                # this dropdown to update with its subchapters as well as updating the chapter information
                # in previous outputs.  See `Dash App With Chained Callbacks <https://dash.plotly.com/basic-callbacks>`_ for a good example
                dbc.Row(
                    [
                        html.H1(children=["Checkpoint Question Analysis"]),
                        dcc.Dropdown(
                            id="subchapter_list",
                        ),
                        dcc.Graph(id="bag_of_donuts"),
                    ]
                ),
            ]
        )
    ],
)

if __name__ == "__main__":
    app.run_server(debug=True)
