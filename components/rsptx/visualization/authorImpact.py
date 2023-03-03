import pandas as pd
from sqlalchemy import create_engine
import altair as alt
from altair import Chart, X, Y, Scale
import os
import datetime
import re

# from altair_saver import save
alt.data_transformers.disable_max_rows()


# In[84]:
def get_enrollment_graph(BASECOURSE):
    dburl = os.environ.get("DEV_DBURL")
    eng = create_engine(dburl)
    # BASECOURSE = 'thinkcspy'
    # TIMEFRAME = '2022-08-01'
    TF = datetime.datetime(2022, 8, 1)
    LY = TF - datetime.timedelta(days=365)

    readers = pd.read_sql_query(
        f"""select * from auth_user 
      join user_courses on auth_user.id = user_courses.user_id 
      join courses on user_courses.course_id = courses.id 
      where courses.base_course = '{BASECOURSE}' and courses.term_start_date >= %(start)s
      """,
        params={"start": TF},
        con=eng,
    )
    readers_ly = pd.read_sql_query(
        f"""select * from auth_user 
      join user_courses on auth_user.id = user_courses.user_id 
      join courses on user_courses.course_id = courses.id 
      where courses.base_course = '{BASECOURSE}' and 
          courses.term_start_date >= %(last_year)s and 
          term_start_date <= now() - interval '1 year'
      """,
        params=dict(last_year=LY),
        con=eng,
    )

    thisyear = readers.groupby(["courselevel"], as_index=False).agg(
        numStudents=("base_course", "count")
    )
    lastyear = readers_ly.groupby(["courselevel"], as_index=False).agg(
        numStudents=("base_course", "count")
    )

    yheight = max(thisyear.numStudents.max(), lastyear.numStudents.max())

    scale = alt.Scale(domain=(0, yheight))

    this_year = (
        Chart(thisyear, title="Current Year")
        .mark_bar()
        .encode(
            x="courselevel", y=alt.Y("numStudents", scale=scale), tooltip="numStudents"
        )
    )
    last_year = (
        Chart(lastyear, title="Previous Year")
        .mark_bar()
        .encode(
            x="courselevel", y=alt.Y("numStudents", scale=scale), tooltip="numStudents"
        )
    )
    res = last_year | this_year
    return res.to_json()


def get_course_graph(BASECOURSE):
    dburl = os.environ.get("DEV_DBURL")
    eng = create_engine(dburl)
    # BASECOURSE = 'thinkcspy'
    # TIMEFRAME = '2022-08-01'
    TF = datetime.datetime(2022, 8, 1)
    LY = TF - datetime.timedelta(days=365)

    courses = pd.read_sql_query(
        """select courselevel, count(*) as num_courses
        from courses 
        where term_start_date >= %(start)s and base_course = %(base)s 
        group by courselevel """,
        params=dict(start=TF, base=BASECOURSE),
        con=eng,
    )

    ly_courses = pd.read_sql_query(
        """select courselevel, count(*) as num_courses
        from courses 
        where term_start_date >= %(start)s and term_start_date < now() - interval '365 days' 
        and base_course = %(base)s 
        group by courselevel """,
        params=dict(start=LY, base=BASECOURSE),
        con=eng,
    )

    yheight = max(courses.num_courses.max(), ly_courses.num_courses.max())

    scale = alt.Scale(domain=(0, yheight))

    y = (
        Chart(courses, title="Current Year")
        .mark_bar()
        .encode(x="courselevel", y=alt.Y("num_courses", scale=scale))
    )
    ly = (
        Chart(ly_courses, title="Previous Year to date")
        .mark_bar()
        .encode(x="courselevel", y=alt.Y("num_courses", scale=scale))
    )

    res = ly | y
    return res.to_json()


# In[ ]:


# ## What other metrics demonstrate impact?
#
# * total page views
# * page views by chapter for this week
# * page views by chapter for the school year
#
#
# ## What other metrics interest authors?
#
# * percent of questions answered correctly on first try
# * percent of questions answered correctly eventually
# * percent of questions attempted but never answered correctly
#
# Drill down from chapter to subchapter to individual questions
#
# * How much time are they spending on different examples
# * What did they learn?
#

# # Page views by chapter since term start

# In[118]:


def get_pv_heatmap(BASECOURSE):
    dburl = os.environ.get("DEV_DBURL")
    eng = create_engine(dburl)
    pv = pd.read_sql_query(
        f"select base_course, chapter, chapter_name, week, count(*) as page_views from page_views where base_course = '{BASECOURSE}' group by base_course, chapter, chapter_name, week;",
        eng,
    )
    pv["chap_num"] = pv.chapter_name.map(lambda x: int(x.split(".")[0]))
    pv["subchap_url"] = pv.chapter.map(lambda x: f"/subchapmap/{x}/{BASECOURSE}")

    y_order = alt.EncodingSortField(
        field="chap_num",  # The field to use for the sort
        order="ascending",  # The order to sort in
    )
    chap_heat = (
        alt.Chart(pv, title="Weekly Chapter Activity")
        .mark_rect()
        .encode(
            x="week:O",
            y=alt.Y("chapter_name", sort=y_order),
            color=alt.Color("page_views", scale=alt.Scale(scheme="lightgreyteal")),
            tooltip="page_views",
            href="subchap_url",
        )
        .configure_axis(labelFontSize=14)
        .configure_view(step=25)
    )

    return chap_heat.to_json()


def get_subchap_num(x):
    parts = x.split(".")
    if len(parts) > 1:
        return int(parts[1])
    else:
        return 999


def get_subchap_heatmap(chapter, BASECOURSE):
    dburl = os.environ.get("DEV_DBURL")
    eng = create_engine(dburl)
    pv = pd.read_sql_query(
        f"select * from page_views where base_course = '{BASECOURSE}' and chapter = '{chapter}'",
        eng,
    )
    pv["subchapnum"] = pv.sub_chapter_name.map(lambda x: x.split()[0])
    svg = (
        pv.groupby(["sub_chapter_name", "week"])
        .agg(page_views=("base_course", "count"), subchap_num=("subchapnum", "min"))
        .reset_index()
    )

    svg["subchap_num"] = svg.subchap_num.map(get_subchap_num)

    y_order = alt.EncodingSortField(
        field="subchap_num",  # The field to use for the sort
        order="ascending",  # The order to sort in
    )
    hm = (
        alt.Chart(svg, title="Weekly Page Activity")
        .mark_rect()
        .encode(
            x="week:O",
            y=alt.Y("sub_chapter_name", sort=y_order),
            color=alt.Color("page_views", scale=alt.Scale(scheme="lightgreyteal")),
            tooltip="page_views",
        )
        .configure_axis(labelFontSize=14)
        .configure_view(step=25)
    )

    return hm.to_json()
