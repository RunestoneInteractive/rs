#!/usr/bin/env python
# coding: utf-8

import os
import random
import re
import numpy as np
import pandas as pd
import pathlib
from sqlalchemy import create_engine
from tqdm import tqdm

tqdm.pandas(desc="Progress...")
import datetime
import altair as alt


def remove_names(row):
    code = row.code
    if row.first_name in row.code:
        code = code.replace(row.first_name, "AnonFirstName")
    if row.last_name in row.code:
        code = code.replace(row.last_name, "AnonLastName")
    return code


def anon_page(name):
    g = re.match("(/runestone/static/.*?/)(.*)", name)
    if g:
        return g[2]
    if g := re.match(r"(.*/runestone/books/.*?/published/)(.*)", name):
        return g[2]

    return name


def get_chap(row):
    divid = row["Problem Name"]
    if row.Selection == "page":
        parts = divid.split("/")
        if len(parts) >= 2:
            return parts[-2]
    else:
        return row["Level (Chapter)"]


def get_subchap(row):
    divid = row["Problem Name"]
    if row.Selection == "page":
        parts = divid.split("/")
        if len(parts) >= 1:
            return parts[-1].replace(".html", "")
    else:
        return row["Level (SubChapter)"]


def find_closest(sid, acid, time, poss):
    """
    Given an sid, acid, time triple find the closest match in time from the code DF
    """
    try:
        candidates = poss.loc[(sid, acid)]
        idx = candidates.index.get_loc(time, method="nearest")
        return candidates.iloc[idx].name
    except:
        return pd.NaT


def get_error_detail(mess):
    if not pd.isna(mess):
        if re.match(r"\w+Error:", mess):
            return mess
        elif mess == "F":
            return "Incorrect"
        elif mess == "T":
            return "Correct"
        else:
            return mess
    else:
        return ""


def fbclass(mess):
    if not pd.isna(mess):
        if re.match(r"\w+Error:", mess):
            return re.match(r"(\w+Error):", mess).group(1)
        elif mess == "F":
            return "Incorrect"
        elif mess == "T":
            return "Correct"
    return mess


class Anonymizer:
    def __init__(
        self,
        basecourse,
        dburl,
        with_assess=False,
        start_date="2019-01-01",
        end_date="2022-05-16",
        sample_size=10,
        include_basecourse=False,
        specific_course="",
    ):
        self.eng = create_engine(dburl)
        self.BASECOURSE = basecourse
        self.WITH_ASSESS = with_assess
        self.START_DATE = start_date
        self.END_DATE = end_date
        self.SAMPLE_SIZE = int(sample_size)
        print(f"include basecourse = {include_basecourse}")
        self.include_basecourse = include_basecourse
        if specific_course:
            self.COURSE_LIST = [specific_course]
        else:
            self.COURSE_LIST = []

    def choose_courses(self):
        if self.WITH_ASSESS:
            pt_courses = pd.read_sql_query(
                """select course_name, count(*) from mchoice_answers
            where div_id ~ 'qpret_.*'
            group by course_name
            having count(*) > 100
            """,
                self.eng,
            )

            mid_courses = pd.read_sql_query(
                """select course_name, count(*) from mchoice_answers
            where div_id ~ 'mid_.*'
            group by course_name
            having count(*) > 100
            """,
                self.eng,
            )

            final_courses = pd.read_sql_query(
                """select course_name, count(*) from mchoice_answers
            where div_id ~ 'pe2_.*'
            group by course_name
            having count(*) > 100
            """,
                self.eng,
            )

            pt_set = set(pt_courses.course_name)
            mid_set = set(mid_courses.course_name)
            final_set = set(final_courses.course_name)

            # classes that have the pretest and either midterm or finala to include final yet
            with_assess = pt_set & (final_set | mid_set)
        else:
            with_assess = False

        courses = pd.read_sql_query(
            f"""select courses.course_name, count(*)
        from courses join user_courses on courses.id = course_id
        where base_course = '{self.BASECOURSE}'
        and term_start_date > '{self.START_DATE}' and term_start_date < '{self.END_DATE}'
        group by courses.course_name
        having count(*) >= 15
        order by count(*) desc""",
            self.eng,
        )
        div = len(courses) // 3

        top = set(courses.course_name[:div])
        middle = set(courses.course_name[div : 2 * div])
        bottom = set(courses.course_name[2 * div :])

        if with_assess:
            top = top & with_assess
            middle = middle & with_assess
            bottom = bottom & with_assess

        size = min(len(top), len(middle), len(bottom))
        if size < self.SAMPLE_SIZE:
            # SAMPLE_SIZE = size
            print(f"Warning: using smaller sample size of {size}")

        top = random.sample(list(top), min(self.SAMPLE_SIZE, len(top)))
        middle = random.sample(list(middle), min(self.SAMPLE_SIZE, len(middle)))
        bottom = random.sample(list(bottom), min(self.SAMPLE_SIZE, len(bottom)))

        self.chosen_courses = top + middle + bottom

        if self.include_basecourse:
            self.chosen_courses.append(self.BASECOURSE)

        if self.COURSE_LIST:
            self.chosen_courses = self.COURSE_LIST

        self.in_course_list = (
            f"""({','.join(["'"+x+"'" for x in self.chosen_courses ])})"""
        )
        print(self.in_course_list)
        return self.chosen_courses

    def get_users(self):

        self.user_df = pd.read_sql_query(
            f"""
        select username, first_name, last_name, courses.course_name, base_course, institution, courselevel, term_start_date
        from auth_user join user_courses on auth_user.id = user_id
            join courses on user_courses.course_id = courses.id
        where courses.course_name in {self.in_course_list}
        """,
            con=self.eng,
        )

        # ## Find instructors
        #
        # Instructors should be eliminated from the data set.
        #

        instructors = pd.read_sql_query(
            f"""
        SELECT
            username
        FROM
	        auth_user
	        JOIN course_instructor ON auth_user.id = instructor
	        JOIN courses ON courses.id = course
        WHERE
	        courses.course_name in {self.in_course_list};
        """,
            self.eng,
        )

        self.inst_set = set(instructors.username)

        self.user_map = {}
        self.user_num = 1
        self.user_df["anon_user"] = self.user_df.username.map(self.anonymize_user)
        self.user_df["is_instructor"] = self.user_df.username.map(
            lambda x: x in self.inst_set
        )

        self.course_map = {}
        self.course_num = 1
        self.user_df["anon_course"] = self.user_df.course_name.map(
            self.anonymize_course
        )

        self.anon_to_base = {}
        for idx, row in self.user_df.iterrows():
            self.anon_to_base[row.anon_course] = row.base_course

        self.user_df["anon_institution"] = self.user_df.institution.map(
            self.anonymize_institution
        )

        # self.user_df.to_csv("user_key.csv", index=False, header=True)

    def anonymize_user(self, id):
        if id not in self.user_map:
            if id in self.inst_set:
                self.user_map[id] = "REMOVEME"
            else:
                self.user_map[id] = self.user_num
                self.user_num += 1
        return self.user_map[id]

    def anonymize_course(self, id):
        if id not in self.course_map:
            self.course_map[id] = self.course_num
            self.course_num += 1
        return self.course_map[id]

    def anonymize_institution(self, name):
        if not name:
            return "none"
        name = name.lower()
        if re.search("high|hs|charter|academy|school", name):
            return "high school"
        elif re.search("college", name):
            return "college"
        elif re.search("university|georgia tech", name):
            return "university"
        else:
            return "unclassified"

    # this should be called like useinfo['act'] = useinfo.apply(self.anonymize_sendmessage, axis=1)
    def anonymize_sendmessage(self, row):
        if row.event == "sendmessage":
            act_parts = row.act.split(":")
            act_parts[1] = str(self.user_map.get(act_parts[1], "Anonymous"))
            return ":".join(act_parts)
        else:
            return row.act

    def anonymize_ratepeer(self, row):
        if row.event == "ratepeer":
            act_parts = row.act.split(":")
            act_parts[0] = str(self.user_map[act_parts[0]])
            return ":".join(act_parts)
        else:
            return row.act

    def get_user_activities(self):
        useinfo = pd.read_sql_query(
            f"""
        select useinfo.timestamp, sid, event, act, div_id, course_id, base_course, chapter, subchapter
            from useinfo left outer join questions on useinfo.div_id = questions.name and questions.base_course = '{self.BASECOURSE}'
            where course_id in {self.in_course_list}
        """,
            con=self.eng,
        )

        code = pd.read_sql_query(
            f"""
        select * from code join courses on code.course_id = courses.id
        where course_name in {self.in_course_list}""",
            self.eng,
        )

        answer_tables = [
            "clickablearea",
            "dragndrop",
            "fitb",
            "mchoice",
            "parsons",
            "unittest",
        ]
        answer_df = []

        for tbl in answer_tables:
            tdf = pd.read_sql_query(
                f"""
            select * from {tbl}_answers where course_name in {self.in_course_list}
            """,
                self.eng,
            )
            tdf["question_type"] = tbl
            answer_df.append(tdf)

        all_answers = pd.concat(answer_df)

        all_answers["sid"] = all_answers.sid.map(
            lambda x: self.user_map.get(x, "REMOVEME")
        )
        all_answers["course_name"] = all_answers.course_name.map(
            lambda x: self.course_map.get(x)
        )

        all_answers = all_answers[
            [
                "timestamp",
                "sid",
                "course_name",
                "div_id",
                "answer",
                "correct",
                "percent",
                "question_type",
            ]
        ]

        all_answers = all_answers[all_answers.sid != "REMOVEME"]

        # ## remove names from the code
        #
        # Students often use their own name as a variable, or add their name as a comment.  This should eliminate names.  Our strategy is simple, we know the first and last name of the student associated with each piece of code.  If replace their first and/or last name with an anonymous equivalent.  This should not break any code, but if it does it should be pretty obvious what the issue is and what was broken

        code_withnames = code.merge(self.user_df, left_on="sid", right_on="username")
        code_withnames["anon_code"] = code_withnames.progress_apply(
            remove_names, axis=1
        )

        useinfo["sid"] = useinfo.sid.map(lambda x: self.user_map.get(x, "REMOVEME"))
        useinfo["course_id"] = useinfo.course_id.map(lambda x: self.course_map.get(x))
        useinfo["base_course"] = useinfo.course_id.map(
            lambda x: self.anon_to_base.get(x)
        )
        # anonymize act field for sendmessage event
        useinfo["act"] = useinfo.apply(self.anonymize_sendmessage, axis=1)
        useinfo["act"] = useinfo.apply(self.anonymize_ratepeer, axis=1)
        # anonymize ratepeer fields
        useinfo["div_id"] = useinfo.div_id.map(anon_page)

        code_withnames["sid"] = code_withnames.sid.map(
            lambda x: self.user_map.get(x, "REMOVEME")
        )
        code_withnames["course_name_y"] = code_withnames.course_name_y.map(
            lambda x: self.course_map.get(x)
        )
        code_withnames = code_withnames[
            ["acid", "anon_code", "sid", "course_name_y", "timestamp", "emessage"]
        ]

        # ## Remove names that could not be anonymized
        useinfo = useinfo[useinfo.sid != "REMOVEME"]
        code_withnames = code_withnames[code_withnames.sid != "REMOVEME"]
        self.user_df = self.user_df[self.user_df.anon_user != "REMOVEME"]

        self.useinfo = useinfo
        self.code_withnames = code_withnames
        self.all_answers = all_answers

    def write_old_files(self):
        useinfo.to_csv(f"{self.BASECOURSE}_useinfo.csv.zip", index=False)

        self.user_df.to_csv(
            f"{self.BASECOURSE}_userinfo.csv.zip",
            columns=[
                "base_course",
                "anon_institution",
                "anon_user",
                "anon_course",
                "courselevel",
                "term_start_date",
            ],
            index=False,
        )

        self.code_withnames.to_csv(f"{self.BASECOURSE}_code.csv.zip", index=False)
        self.all_answers.to_csv(f"{self.BASECOURSE}_answers.csv.zip", index=False)

    # ## Sessionize the data
    #
    # The best approximation of a session is to group everything together that is close in time.
    # For example, a 30 minute gap likely means the student has gone away and come back but we could make that an hour.  Some experimenting is needed and google analytics show that the average time on page for some pages is 30 minutes!
    def sessionize_data(self):

        self.useinfo = self.useinfo.sort_values(["sid", "timestamp"])
        self.useinfo["session"] = 0
        self.useinfo["problem_view"] = 0

        self.mins10 = pd.Timedelta(10, "minutes")
        self.mins15 = pd.Timedelta(15, "minutes")
        self.mins20 = pd.Timedelta(20, "minutes")
        self.mins30 = pd.Timedelta(30, "minutes")
        self.mins60 = pd.Timedelta(60, "minutes")

        # The below is very expensive for long operations.  Maybe we could rewrite it with a rolling function

        self.useinfo["tdiff"] = self.useinfo.timestamp.diff()
        self.useinfo["sdiff"] = self.useinfo.sid.diff()
        self.sess_count = 0
        self.useinfo["session"] = self.useinfo.progress_apply(self.sessionize, axis=1)
        self.student_problem_ct = {}
        self.useinfo["problem_view"] = self.useinfo.progress_apply(
            self.actcount, axis=1
        )

    def sessionize(self, row):
        if row.tdiff > self.mins60 or row.sdiff != 0:
            self.sess_count += 1

        return self.sess_count

    def actcount(self, row):
        if row.sid not in self.student_problem_ct:
            self.student_problem_ct[row.sid] = {}
        self.student_problem_ct[row.sid][row.div_id] = (
            self.student_problem_ct[row.sid].get(row.div_id, 0) + 1
        )
        return self.student_problem_ct[row.sid][row.div_id]

    # In[61]:

    def create_datashop_data(self):

        useinfo_w_answers = self.useinfo.merge(
            self.all_answers,
            left_on=["sid", "div_id", "course_id", "timestamp"],
            right_on=["sid", "div_id", "course_name", "timestamp"],
            how="left",
        )

        useinfo_w_answers = useinfo_w_answers.drop_duplicates()

        useinfo_w_answers = useinfo_w_answers.merge(
            self.user_df[["anon_user", "term_start_date", "anon_institution"]],
            left_on="sid",
            right_on="anon_user",
        )

        useinfo_w_answers.term_start_date = pd.to_datetime(
            useinfo_w_answers.term_start_date
        )

        useinfo_w_answers["week_no"] = (
            useinfo_w_answers.timestamp - useinfo_w_answers.term_start_date
        ).dt.days // 7

        useinfo_w_answers = useinfo_w_answers[
            [
                "timestamp",
                "sid",
                "act",
                "div_id",
                "course_id",
                "chapter",
                "subchapter",
                "session",
                "problem_view",
                "event",
                "answer",
                "correct",
                "week_no",
                "anon_institution",
            ]
        ]

        useinfo_w_answers.columns = [
            "Time",
            "Anon Student Id",
            "Action",
            "Problem Name",
            "Class",
            "Level (Chapter)",
            "Level (SubChapter)",
            "Session Id",
            "Problem View",
            "Selection",
            "Input",
            "Feedback Classification",
            "CF (Week No)",
            "CF (Institution)",
        ]

        useinfo_w_answers["Level (Chapter)"] = useinfo_w_answers.apply(get_chap, axis=1)
        useinfo_w_answers["Level (SubChapter)"] = useinfo_w_answers.apply(
            get_subchap, axis=1
        )

        # ## Find the nearest timestamps in `code`

        # Create a Multi-Index out of sid, acid and timestamp.  This will allow us to efficiently grab all of the rows for an (sid, acid) pair that will be indexed by timestamp.
        #
        # Then we can use `get_loc` with `method='nearest'` to find the timestamp closest to the given timestamp.  `get_loc` returns the numeric index of that row, so we need to use iloc to grab the actual row.  since the timestamp is the index we use `.name` to return the index value, which is the timestamp we are after.

        poss = self.code_withnames.sort_values(["sid", "acid", "timestamp"]).set_index(
            ["sid", "acid"]
        )

        poss = poss.reset_index()
        poss = poss.set_index(["sid", "acid", "timestamp"])

        # the last idea to speed this up is to try to index the timestamps and then use get_loc(ts, method='nearest') to search the index.
        useinfo_w_answers["closest_time"] = useinfo_w_answers.progress_apply(
            lambda row: find_closest(
                row["Anon Student Id"], row["Problem Name"], row["Time"], poss
            ),
            axis=1,
        )

        td_5sec = pd.Timedelta(5, "seconds")
        useinfo_w_answers.closest_time = useinfo_w_answers.progress_apply(
            lambda x: x.closest_time
            if not pd.isna(x.closest_time)
            and not pd.isna(x.Time)
            and abs(x.closest_time - x.Time) < td_5sec
            else pd.NaT,
            axis=1,
        )

        # pd.to_datetime(useinfo_w_answers.closest_time)
        useinfo_w_answers[
            abs(useinfo_w_answers.closest_time - useinfo_w_answers.Time) < td_5sec
        ]

        y = useinfo_w_answers.merge(
            self.code_withnames,
            left_on=["Anon Student Id", "Problem Name", "closest_time"],
            right_on=["sid", "acid", "timestamp"],
            how="left",
        )

        y["CF (Code)"] = y.apply(
            lambda row: row.anon_code if not pd.isna(row.anon_code) else "", axis=1
        )

        y["Feedback Classification"] = y.apply(
            lambda row: row.emessage
            if not pd.isna(row.emessage)
            else row["Feedback Classification"],
            axis=1,
        )

        y = y.drop_duplicates()

        y = y.sort_values("Time")

        # **Feedback Text**		The body of a hint, success, or error message shown to the student.	≤ 65,535
        #
        # **Feedback Classification**		A further classification of the outcome. See action_evaluation / classification in the Guide. Note that if Feedback Classification has a value, Feedback Text must have a value as well.	≤ 255

        y["Feedback Text"] = y["Feedback Classification"].map(get_error_detail)
        y["Feedback Classification"] = y["Feedback Classification"].map(fbclass)

        # **Warning** pandas treats string columsn as objects and when you export them you have to be careful about the newlines.  Some spreadsheets like Numbers and Sheets deal with it just fine, but Excel and -- Data Shop - the target for this notebook do not.  Therefore we can use the trick below for the feedback text and code to ensure that the newlines end up in the string as \n
        y["Input"] = y["Input"].astype("str")
        y["Feedback Text"] = y["Feedback Text"].str.replace("\n", "\\n")
        y["CF (Code)"] = y["CF (Code)"].str.replace("\n", "\\n")
        y.Action = y.Action.str.replace("\n", "")
        y.Input = y.Input.str.replace("nan", "")

        self.datashop = y[
            [
                "Time",
                "Anon Student Id",
                "Action",
                "Problem Name",
                "Class",
                "Level (Chapter)",
                "Level (SubChapter)",
                "Session Id",
                "Problem View",
                "Selection",
                "Input",
                "Feedback Text",
                "Feedback Classification",
                "CF (Code)",
                "CF (Week No)",
                "CF (Institution)",
            ]
        ]

    def write_datashop(self, path="./"):
        p = pathlib.Path(path, f"{self.BASECOURSE}_datashop.tab.zip")
        self.datashop.to_csv(
            p,
            sep="\t",
            index=False,
            compression="infer",
            columns=[
                "Time",
                "Anon Student Id",
                "Action",
                "Problem Name",
                "Class",
                "Level (Chapter)",
                "Level (SubChapter)",
                "Session Id",
                "Problem View",
                "Selection",
                "Input",
                "Feedback Text",
                "Feedback Classification",
                "CF (Code)",
                "CF (Week No)",
                "CF (Institution)",
            ],
        )


if __name__ == "__main__":
    a = Anonymizer(
        "py4e-int",
        os.environ["DBURL"],
        sample_size=3,
        cl=["Win22-SI206", "Win21-SI206"],
    )
    print("Choosing Courses")
    a.choose_courses()
    print(a.chosen_courses)
    print("Getting Users")
    a.get_users()
    print("Getting user activities")
    a.get_user_activities()
    print("sessionizing")
    a.sessionize_data()
    print("combining to datashop")
    a.create_datashop_data()
    a.write_datashop()
