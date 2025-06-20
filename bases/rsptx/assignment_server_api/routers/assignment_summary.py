# %%
import pandas as pd
import numpy as np
from sqlalchemy import create_engine


def create_assignment_summary(assignment_id, course, dburl):

    COURSE_NAME = course.course_name
    COURSE_ID = course.id
    BASE_COURSE = course.base_course
    ASSIGNMENT_ID = assignment_id
    eng = create_engine(dburl)

    df = pd.read_sql(
        f"""
    select sid, div_id, score, chapter, points, subchapter
    from assignment_questions
    join  questions on assignment_questions.question_id = questions.id
    join question_grades on questions.name = question_grades.div_id
    where question_grades.course_name = '{COURSE_NAME}' and assignment_id = {ASSIGNMENT_ID}""",
        eng,
    )

    div_id_to_chapter = df[['div_id', 'chapter', 'points']].drop_duplicates().set_index('div_id').T.to_dict()
    div_id_to_chapter = {k: {'chapter': v['chapter'], 'points': v['points']} for k, v in div_id_to_chapter.items()}
    pt = df.pivot(index="sid", columns="div_id", values="score").reset_index()
    students = pd.read_sql(
        f"""
                        select username, first_name, last_name from auth_user
                        join user_courses on auth_user.id = user_courses.user_id
                        where user_courses.course_id = {COURSE_ID}
                        """,
        eng,
    )

    summary = (
        students.merge(pt, left_on="username", right_on="sid", how="outer")
        .drop(columns=["sid"])
        .rename(
            columns={
                "username": "Student ID",
                "first_name": "First Name",
                "last_name": "Last Name",
            }
        )
        .sort_values(by=["Last Name", "First Name"])
    )
    summary["total"] = summary.iloc[:, 3:].sum(axis=1, numeric_only=True)
    numeric_columns = summary.columns[3:]
    summary.loc["average"] = summary[numeric_columns].mean()
    summary.replace({np.nan: 0}, inplace=True)
    summary_no_index = summary.iloc[:-1].reset_index(drop=True)
    summary = pd.concat([summary_no_index, summary.iloc[[-1]]])

    # Now get the number of attempts for each student
    attdf = pd.read_sql(
        f"""
    select div_id, sid, correct, percent, chapter, subchapter
    from (
        (select div_id, sid, correct, percent from mchoice_answers where course_name='{COURSE_NAME}')
        union
        (select div_id, sid, correct, percent from fitb_answers where course_name = '{COURSE_NAME}')
        union
        (select div_id, sid, correct, percent from parsons_answers where course_name = '{COURSE_NAME}')
        union
        (select div_id, sid, correct, percent from codelens_answers where course_name = '{COURSE_NAME}')
        union
        (select div_id, sid, correct, percent from clickablearea_answers where course_name = '{COURSE_NAME}')
        union
        (select div_id, sid, correct, percent from dragndrop_answers where course_name = '{COURSE_NAME}')
        union
        (select div_id, sid, correct, percent from webwork_answers where course_name = '{COURSE_NAME}')
        union
        (select div_id, sid, correct, percent from matching_answers where course_name = '{COURSE_NAME}')
        union
        (select div_id, sid, correct, percent from microparsons_answers where course_name = '{COURSE_NAME}')
        union
        (select div_id, sid, correct, percent from splice_answers where course_name = '{COURSE_NAME}')
        union
        (select div_id, sid, correct, percent from unittest_answers where course_name = '{COURSE_NAME}')
        union
        (select div_id, sid, 'F', 0.0 from shortanswer_answers where course_name = '{COURSE_NAME}')
    ) as T
    join questions on div_id = name 
    join assignment_questions on questions.id = assignment_questions.question_id
    where assignment_id = {ASSIGNMENT_ID}
    """,
        eng,
    )
    attempts = attdf.groupby(["div_id", "sid"]).agg(count=("correct", "count"))
    # get the count for ex_2_8 for bmiller using the attempts dataframe after the groupby
    # attempts.loc[('ex_2_8', 'bmiller'), 'count']
    x = attempts.reset_index()
    attp = x.pivot(index="sid", columns="div_id", values="count").fillna(0).astype(int)
    attp.reset_index(inplace=True)
    attp = (
        students.merge(attp, left_on="username", right_on="sid", how="outer")
        .drop(columns=["sid"])
        .rename(
            columns={
                "username": "Student ID",
                "first_name": "First Name",
                "last_name": "Last Name",
            }
        )
        .sort_values(by=["Last Name", "First Name"])
    )
    exercises = set(summary.columns[3:].to_list() + attp.columns[3:].to_list())
    exercises.remove("total")
    attp.replace({np.nan: 0}, inplace=True)
    merged = summary.merge(
        attp, on=["Student ID", "First Name", "Last Name"], how="outer"
    )
    merged = merged.fillna(0)    
    for col in exercises:
        # convert aaa_y columns to int
        if col + "_y" in merged.columns:
            try:
                merged[col + "_y"] = merged[col + "_y"].map(int).astype(int)
            except ValueError:
                print(f"ValueError: {col + '_y'} cannot be converted to int")
        if f"{col}_x" not in merged.columns:
            merged[col] = "0.0 (0)"
            continue

        merged[col] = (
            merged[col + "_x"].astype(str) + " (" + merged[col + "_y"].astype(str) + ")"
        )
        merged.drop(columns=[col + "_x", col + "_y"], inplace=True)
    merged.replace({np.nan: ""}, inplace=True)

    merged = merged[
        ["Student ID", "First Name", "Last Name"] + list(exercises) + ["total"]
    ]
    try:
        merged.iloc[0, 3:] = merged.iloc[0, 3:].apply(
            lambda x: "{:.2f}".format(float(x.split("(")[0])) if type(x) is str and "(" in x else "{:.2f}".format(float(x))
        )
    except Exception as e:
        print(
            f"Error formatting the last row of the summary. Check the data types and values. {merged.iloc[-1, 3:]} : {e}"
        )
    if merged.iloc[0, 0] == 0 and merged.iloc[0, 1] == 0 and merged.iloc[0, 2] == 0:
        merged.iloc[0, 0] = ""
        merged.iloc[0, 1] = ""
        merged.iloc[0, 2] = "Average"

    return merged.to_dict(
        orient="records",
    ), div_id_to_chapter
