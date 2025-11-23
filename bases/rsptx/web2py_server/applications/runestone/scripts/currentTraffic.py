import pandas as pd
from sqlalchemy import create_engine
from altair import Chart
import os.path
import datetime


eng = create_engine(os.environ["DBURL"])

last_day = pd.read_sql_query(
    """
select date_trunc('hour', timestamp) date_bucket, count(distinct sid) from useinfo where timestamp > now() - interval
 '49 hours' group by date_bucket
 """,
    eng,
    parse_dates=["date_bucket"],
)

last_five = pd.read_sql_query(
    """
select count(distinct sid) from useinfo where timestamp > now() - interval '5 minutes'
""",
    eng,
)

last_day["date_bucket"] = last_day.date_bucket - datetime.timedelta(hours=8)


hc = (
    Chart(
        last_day,
        title=f"Unique Students Per Hour - Current: {last_five.iloc[0]['count']}",
    )
    .mark_area()
    .encode(x="date_bucket", y="count")
)
hc.save("chart.png")
