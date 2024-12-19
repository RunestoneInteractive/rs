# *******************************
# |docname| - route to a textbook
# *******************************
# This controller provides routes to admin functions
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8
# <http://www.python.org/dev/peps/pep-0008/#imports>`_.
#
# Standard library
# ----------------
import json
import logging
import os
import random

# Third Party
# -----------
import altair as alt
import pandas as pd
import redis
from dateutil.parser import parse
from rs_grading import _try_to_send_lti_grade

logger = logging.getLogger(settings.logger)
logger.setLevel(settings.log_level)

peerjs = os.path.join("applications", request.application, "static", "js", "peer.js")
try:
    mtime = int(os.path.getmtime(peerjs))
except FileNotFoundError:
    mtime = random.randrange(10000)

request.peer_mtime = str(mtime)


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_id, auth.user),
    requires_login=True,
)
def instructor():
    assignments = db(
        (db.assignments.is_peer == True)
        & (db.assignments.course == auth.user.course_id)
    ).select(orderby=~db.assignments.duedate)

    course_attrs = getCourseAttributesDict(auth.user.course_id)

    return dict(
        course_id=auth.user.course_name,
        course=get_course_row(db.courses.ALL),
        assignments=assignments,
        is_instructor=True,
        **course_attrs,
    )


# Instructor's interface to peer
# ------------------------------
@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_id, auth.user),
    requires_login=True,
)
def dashboard():
    """
    We track through questions by "submitting" the form that causes us
    to go to the next question.
    """
    assignment_id = request.vars.assignment_id
    if request.vars.next == "Next":
        next = True
    elif request.vars.next == "Reset":
        next = "Reset"
    else:
        next = False
    current_question, done = _get_current_question(assignment_id, next)
    assignment = db(db.assignments.id == assignment_id).select().first()
    course = db(db.courses.course_name == auth.user.course_name).select().first()

    course_attrs = getCourseAttributesDict(course.id, course.base_course)
    if "enable_ab" not in course_attrs:
        course_attrs["enable_ab"] = False

    if "latex_macros" not in course_attrs:
        course_attrs["latex_macros"] = ""
    db.useinfo.insert(
        course_id=auth.user.course_name,
        sid=auth.user.username,
        div_id=current_question.name,
        event="peer",
        act="start_question",
        timestamp=datetime.datetime.utcnow(),
    )
    is_lti = db(db.course_lti_map.course_id == auth.user.course_id).count() > 0
    print("is_lti", is_lti)
    r = redis.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
    r.hset(f"{auth.user.course_name}_state", "mess_count", "0")
    mess = {
        "sender": auth.user.username,
        "type": "control",
        "message": "enableNext",
        "broadcast": True,
        "course_name": auth.user.course_name,
    }
    r.publish("peermessages", json.dumps(mess))
    if "groupsize" not in course_attrs:
        course_attrs["groupsize"] = "3"

    return dict(
        course_id=auth.user.course_name,
        course=get_course_row(db.courses.ALL),
        current_question=current_question,
        assignment_id=assignment_id,
        assignment_name=assignment.name,
        is_instructor=True,
        is_last=done,
        lti=is_lti,
        **course_attrs,
    )


def extra():
    assignment_id = request.vars.assignment_id
    current_question, done = _get_current_question(assignment_id, False)

    return dict(
        course_id=auth.user.course_name,
        course=get_course_row(db.courses.ALL),
        current_question=current_question,
        assignment_id=assignment_id,
        is_instructor=True,
    )


def _get_current_question(assignment_id, get_next):
    assignment = db(db.assignments.id == assignment_id).select().first()

    if get_next == "Reset":
        idx = 0
        db(db.assignments.id == assignment_id).update(current_index=idx)
    elif get_next is True:
        idx = assignment.current_index + 1
        db(db.assignments.id == assignment_id).update(current_index=idx)
    else:
        idx = assignment.current_index
    db.commit()  # commit changes to current question to prevent race condition.
    return _get_numbered_question(assignment_id, idx)


def _get_numbered_question(assignment_id, qnum):
    a_qs = db(db.assignment_questions.assignment_id == assignment_id).select(
        orderby=[db.assignment_questions.sorting_priority, db.assignment_questions.id]
    )
    done = "false"
    if qnum > len(a_qs) - 1:
        qnum = len(a_qs) - 1
    if qnum == len(a_qs) - 1:
        done = "true"

    current_question_id = a_qs[qnum].question_id
    current_question = db(db.questions.id == current_question_id).select().first()

    return current_question, done


def _get_lastn_answers(num_answer, div_id, course_name, start_time, end_time=None):
    dburl = settings.database_uri.replace("postgres://", "postgresql://")

    time_clause = f"""
        AND timestamp > '{start_time}'
        """
    if end_time:
        time_clause += f" AND timestamp < '{end_time}'"

    df = pd.read_sql_query(
        f"""
    WITH first_answer AS (
        SELECT
            *,
            ROW_NUMBER() OVER (
                PARTITION BY sid
                ORDER BY
                    id desc
            ) AS rn
        FROM
            mchoice_answers
        WHERE
            div_id = '{div_id}'
            AND course_name = '{course_name}'
            {time_clause}
    )
    SELECT
        *
    FROM
        first_answer
    WHERE
        rn <= {num_answer}
    ORDER BY
        sid
    limit 4000
    """,
        dburl,
    )
    df = df.dropna(subset=["answer"])
    logger.debug(df.head())
    # FIXME: this breaks for multiple answer mchoice!
    df = df[df.answer != ""]

    return df


def to_letter(astring: str):
    if astring.isnumeric():
        return chr(65 + int(astring))
    if "," in astring:
        alist = astring.split(",")
        alist = [chr(65 + int(x)) for x in alist]
        return ",".join(alist)
    return None


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_id, auth.user),
    requires_login=True,
)
def chartdata():
    response.headers["content-type"] = "application/json"
    div_id = request.vars.div_id
    start_time = request.vars.start_time
    end_time = request.vars.start_time2  # start time of vote 2
    num_choices = request.vars.num_answers
    course_name = auth.user.course_name
    logger.debug(f"divid = {div_id}")
    df1 = _get_lastn_answers(1, div_id, course_name, start_time, end_time)
    if end_time:
        df2 = _get_lastn_answers(1, div_id, course_name, end_time)
        df2.rn = 2
        df = pd.concat([df1, df2])
    else:
        df = df1
    df["letter"] = df.answer.map(to_letter)
    x = df.groupby(["letter", "rn"])["answer"].count()
    df = x.reset_index()
    yheight = df.answer.max()
    alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    y = pd.DataFrame(
        {
            "letter": list(alpha[:num_choices] * 2),
            "rn": [1] * num_choices + [2] * num_choices,
            "answer": [0] * num_choices * 2,
        }
    )
    df = df.merge(y, how="outer")
    c = (
        alt.Chart(df[df.rn == 1], title="First Answer")
        .mark_bar()
        .encode(
            x="letter",
            y=alt.Y(
                "sum(answer)",
                title="Number of Students",
                scale=alt.Scale(domain=(0, yheight)),
            ),
        )
    )
    d = (
        alt.Chart(df[df.rn == 2], title="Second Answer")
        .mark_bar()
        .encode(
            x="letter",
            y=alt.Y(
                "sum(answer)",
                title="Number of Students",
                scale=alt.Scale(domain=(0, yheight)),
            ),
        )
    )

    return alt.hconcat(c, d).to_json()


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_id, auth.user),
    requires_login=True,
)
def num_answers():
    response.headers["content-type"] = "application/json"
    div_id = request.vars.div_id
    if not request.vars.start_time:
        return json.dumps({"count": 0, "mess_count": 0})

    acount = db(
        (db.mchoice_answers.div_id == div_id)
        & (db.mchoice_answers.course_name == auth.user.course_name)
        & (db.mchoice_answers.timestamp > parse(request.vars.start_time))
    ).count(distinct=db.mchoice_answers.sid)

    mess_count = db(
        (db.useinfo.div_id == div_id)
        & (db.useinfo.course_id == auth.user.course_name)
        & (db.useinfo.event == "sendmessage")
        & (db.useinfo.timestamp > parse(request.vars.start_time))
    ).count()

    return json.dumps({"count": acount, "mess_count": mess_count})


def percent_correct():
    div_id = request.vars.div_id
    start_time = request.vars.start_time
    course_name = request.vars.course_name
    df = _get_lastn_answers(1, div_id, course_name, start_time)
    logger.debug(f"Data Frame is {df}")
    tot = len(df)
    logger.debug(f"num rows = {tot}")
    corr = len(df[df.correct == "T"])
    if corr == 0:
        return json.dumps({"pct_correct": "No Correct Answers"})
    else:
        return json.dumps({"pct_correct": corr / tot * 100})


#
# Student Facing pages
#
@auth.requires_login()
def student():
    if "access_token" not in request.cookies:
        # this means the user is logged in to web2py but not fastapi - this is not good
        # as the javascript in the questions assumes the new server and a token.
        logger.error(f"Missing Access Token: {auth.user.username} adding one Now")
        create_rs_token()

    assignments = db(
        (db.assignments.is_peer == True)
        & (db.assignments.course == auth.user.course_id)
        & (db.assignments.visible == True)
    ).select(orderby=~db.assignments.duedate)
    course = db(db.courses.course_name == auth.user.course_name).select().first()
    course_attrs = getCourseAttributesDict(course.id, course.base_course)
    if "latext_macros" not in course_attrs:
        course_attrs["latex_macros"] = ""

    return dict(
        course_id=auth.user.course_name,
        course=get_course_row(db.courses.ALL),
        assignments=assignments,
        **course_attrs,
    )


# Student's Interface to Peer Instruction
# ---------------------------------------
@auth.requires_login()
def peer_question():
    if "access_token" not in request.cookies:
        return redirect(URL("default", "accessIssue"))

    assignment_id = request.vars.assignment_id

    current_question, done = _get_current_question(assignment_id, False)
    assignment = db(db.assignments.id == assignment_id).select().first()
    course = db(db.courses.course_name == auth.user.course_name).select().first()
    course_attrs = getCourseAttributesDict(course.id, course.base_course)
    if "latex_macros" not in course_attrs:
        course_attrs["latex_macros"] = ""

    return dict(
        course_id=auth.user.course_name,
        course=get_course_row(db.courses.ALL),
        current_question=current_question,
        assignment_name=assignment.name,
        assignment_id=assignment_id,
        **course_attrs,
    )


def find_good_partner(group, peeps, answer_dict):
    # try to find a partner with a different answer than the first group member
    logger.debug(f"here {group}, {peeps}, {answer_dict}")
    ans = answer_dict[group[0]]
    i = 0
    while i < len(peeps) and answer_dict[peeps[i]] == ans:
        logger.debug(f"{i} : {peeps[i]}")
        i += 1

    if i < len(peeps):
        return peeps.pop(i)
    else:
        return peeps.pop()


def process_peep(p, peeps, target_list, other_list, in_person_groups, mode):
    target_list.append(p)
    peeps.remove(p)
    other_peeps = find_set_containing_string(in_person_groups, p)
    logger.debug(f"other_peeps = {other_peeps}")
    # if no other peeps then this person must be put into a chat group not an in-person group
    if not other_peeps and mode == "in_person":
        other_list.append(p)
        return
    for op in other_peeps:
        if op in peeps:
            peeps.remove(op)
            logger.debug(f"removed {op} from the peeps list")
        if op not in target_list:
            target_list.append(op)


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_id, auth.user),
    requires_login=True,
)
def make_pairs():
    response.headers["content-type"] = "application/json"
    is_ab = request.vars.get("is_ab", False)
    div_id = request.vars.div_id
    df = _get_lastn_answers(1, div_id, auth.user.course_name, request.vars.start_time)
    group_size = int(request.vars.get("group_size", 2))
    r = redis.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
    logger.debug(f"Clearing partnerdb_{auth.user.course_name}")
    r.delete(f"partnerdb_{auth.user.course_name}")

    logger.debug(f"STARTING to make pairs for {auth.user.course_name}")
    done = False
    peeps = df.sid.to_list()
    sid_ans = df.set_index("sid")["answer"].to_dict()

    # If the instructor is in the list of students, remove them
    if auth.user.username in peeps:
        peeps.remove(auth.user.username)

    # Shuffle the list of students
    random.shuffle(peeps)

    # Create a list of groups
    group_list = []
    done = len(peeps) == 0
    if is_ab:
        in_person_groups = _get_local_groups(auth.user.course_name)
        peeps_in_person = []
        peeps_in_chat = []

        peep_queue = peeps[:]
        while peep_queue:
            p = peep_queue.pop()
            if p in peeps_in_person or p in peeps_in_chat:
                continue

            if random.random() < 0.5:
                logger.debug(f"adding {p} to the in_person list")
                process_peep(
                    p,
                    peeps,
                    peeps_in_person,
                    peeps_in_chat,
                    in_person_groups,
                    "in_person",
                )
            else:
                process_peep(
                    p, peeps, peeps_in_chat, peeps_in_person, in_person_groups, "chat"
                )

        peeps = peeps_in_chat
        # Now peeps contains only those who need to be paired up for chat
        logger.debug(f"FINAL PEEPS IN CHAT = {peeps}")
        logger.debug(f"FINAL PEEPS IN PERSON = {peeps_in_person}")
    done = len(peeps) == 0
    while not done:
        # Start a new group with one student
        group = [peeps.pop()]

        # Try to add more students to the group
        for i in range(group_size - 1):
            try:
                # Find a student with a different answer than the first student in the group
                group.append(find_good_partner(group, peeps, sid_ans))
            except IndexError:
                # If no more students are left to add, stop
                done = True
        # If the group only has one student, add them to the previous group
        if len(group) == 1:
            group_list[-1].append(group[0])
        else:
            # Otherwise add the group to the list of groups
            group_list.append(group)

        # Stop if all students have been grouped
        if len(peeps) == 0:
            done = True

    # Create a dictionary mapping each student to their group
    gdict = {}
    for group in group_list:
        for p in group:
            gl = group.copy()
            gl.remove(p)
            gdict[p] = gl

    # Save the groups to the redis database
    for k, v in gdict.items():
        r.hset(f"partnerdb_{auth.user.course_name}", k, json.dumps(v))
    r.hset(f"{auth.user.course_name}_state", "mess_count", "0")
    logger.info(f"DONE makeing pairs for {auth.user.course_name} {gdict}")
    # todo: if we are doing AB testing then we need not broadcast or maybe broadcast,
    # but with a way for individual students to know if they are in person or not
    # maybe a in_persondb paralell to the partnerdb that can be sent like the enableChat
    # which is not broadcast!
    _broadcast_peer_answers(sid_ans)
    logger.info(f"DONE broadcasting pair information")
    # todo: broadcast the enableFaceChat message to the in-person chatters
    if is_ab:
        _broadcast_faceChat(peeps_in_person)
    return json.dumps("success")


def find_set_containing_string(list_of_sets, target_string):
    # iterating over all sets ensures that even if someone forgets to enter their group
    # or someone accidentally leaves someone out of the group we will still find them
    result_set = set()
    for s in list_of_sets:
        if target_string in s:
            result_set |= s
    return result_set


def _get_local_groups(course_name):
    query = f"""
SELECT u1.*
FROM useinfo u1
JOIN (
    SELECT sid, MAX(timestamp) AS last_entry
    FROM useinfo
    WHERE course_id = '{course_name}' and event = 'peergroup'
    GROUP BY sid
) u2 ON u1.sid = u2.sid AND u1.timestamp = u2.last_entry
WHERE u1.course_id = '{course_name}' and u1.event = 'peergroup';
"""
    in_person_groups = []
    res = db.executesql(query)
    for row in res:
        logger.debug(row)
        # act is index 4
        peeps = row[4].split(":")[1]
        peeps = set(peeps.split(","))
        # sid is index 2
        if row[2] not in peeps:
            peeps.add(row[2])
        in_person_groups.append(peeps)

    return in_person_groups


def _broadcast_peer_answers(answers):
    """
    The correct and incorrect lists are dataframes that containe the sid and their answer
    We want to iterate over the
    """

    r = redis.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
    for p1, p2 in r.hgetall(f"partnerdb_{auth.user.course_name}").items():
        p1 = p1.decode("utf8")
        partner_list = json.loads(p2)
        pdict = {}
        for p2 in partner_list:
            ans = to_letter(answers.get(p2, None))
            pdict[p2] = ans
        # create a message from p1 to put into the publisher queue
        # it seems odd to not have a to field in the message...
        # but it is not necessary as the client can figure out how it is to
        # based on who it is from.
        mess = {
            "type": "control",
            "from": p1,
            "to": p1,
            "message": "enableChat",
            "broadcast": False,
            "answer": json.dumps(pdict),
            "course_name": auth.user.course_name,
        }
        r.publish("peermessages", json.dumps(mess))


def _broadcast_faceChat(peeps):
    """
    Send the message to enable the face chat to the students in the peeps list
    """

    r = redis.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
    for p in peeps:
        # create a message from p1 to put into the publisher queue
        # it seems odd to not have a to field in the message...
        # but it is not necessary as the client can figure out how it is to
        # based on who it is from.
        mess = {
            "type": "control",
            "from": p,
            "to": p,
            "message": "enableFaceChat",
            "broadcast": False,
            "course_name": auth.user.course_name,
        }
        r.publish("peermessages", json.dumps(mess))


def clear_pairs():
    response.headers["content-type"] = "application/json"
    r = redis.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
    r.delete(f"partnerdb_{auth.user.course_name}")
    return json.dumps("success")


def publish_message():
    response.headers["content-type"] = "application/json"
    r = redis.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
    data = json.dumps(request.vars)
    logger.info(
        f"PEERCOM data = {data} {os.environ.get('REDIS_URI', 'redis://redis:6379/0')}"
    )
    r.publish("peermessages", data)
    res = r.hget(f"{auth.user.course_name}_state", "mess_count")
    if res is not None:
        mess_count = int(res)
    else:
        mess_count = 0
    if request.vars.type == "text":
        r.hset(f"{auth.user.course_name}_state", "mess_count", str(mess_count + 1))
    return json.dumps("success")


def log_peer_rating():
    response.headers["content-type"] = "application/json"
    current_question = request.vars.div_id
    peer_sid = request.vars.peer_id
    r = redis.from_url(os.environ.get("REDIS_URI", "redis://redis:6379/0"))
    retmess = "Error: no peer to rate"
    if peer_sid:
        db.useinfo.insert(
            course_id=auth.user.course_name,
            sid=auth.user.username,
            div_id=current_question,
            event="ratepeer",
            act=f"{peer_sid}:{request.vars.rating}",
            timestamp=datetime.datetime.utcnow(),
        )
        retmess = "success"

    return json.dumps(retmess)


# Students Async Interface to Peer Instruction
# --------------------------------------------


@auth.requires_login()
def peer_async():
    if "access_token" not in request.cookies:
        return redirect(URL("default", "accessIssue"))

    assignment_id = request.vars.assignment_id

    qnum = 0
    if request.vars.question_num:
        qnum = int(request.vars.question_num)

    current_question, all_done = _get_numbered_question(assignment_id, qnum)
    course = db(db.courses.course_name == auth.user.course_name).select().first()
    course_attrs = getCourseAttributesDict(course.id, course.base_course)
    if "latex_macros" not in course_attrs:
        course_attrs["latex_macros"] = ""

    return dict(
        course_id=auth.user.course_name,
        course=get_course_row(db.courses.ALL),
        current_question=current_question,
        assignment_id=assignment_id,
        nextQnum=qnum + 1,
        all_done=all_done,
        **course_attrs,
    )


@auth.requires_login()
def get_async_explainer():
    course_name = request.vars.course
    sid = auth.user.username
    div_id = request.vars.div_id

    this_answer = _get_user_answer(div_id, sid)

    # Messages are in useinfo with an event of "sendmessage" and a div_id corresponding to the div_id of the question.
    # The act field is to:user:message
    # Ratings of messages are in useinfo with an event of "ratepeer"
    # the act field is rateduser:rating (excellent, good, poor)
    ratings = []
    for rate in ["excellent", "good"]:
        ratings = db(
            (db.useinfo.event == "ratepeer")
            & (db.useinfo.act.like(f"%{rate}"))
            & (db.useinfo.div_id == div_id)
            & (db.useinfo.course_id == course_name)
        ).select()
        if len(ratings) > 0:
            break

    if len(ratings) > 0:
        done = False
        tries = 0
        while not done and tries < 10:
            idx = random.randrange(len(ratings))
            act = ratings[idx].act
            user = act.split(":")[0]
            peer_answer = _get_user_answer(div_id, user)
            if peer_answer != this_answer:
                done = True
            else:
                tries += 1
        mess, participants = _get_user_messages(user, div_id, course_name)
        # This is the easy solution, but may result in a one-sided conversation.
        if user in participants:
            participants.remove(user)
    else:
        messages = db(
            (db.useinfo.event == "sendmessage")
            & (db.useinfo.div_id == div_id)
            & (db.useinfo.course_id == course_name)
        ).select(db.useinfo.sid)
        if len(messages) > 0:
            senders = set((row.sid for row in messages))
            done = False
            tries = 0
            while not done and tries < 10:
                user = random.choice(list(senders))
                peer_answer = _get_user_answer(div_id, user)
                if peer_answer != this_answer:
                    done = True

                else:
                    tries += 1
            mess, participants = _get_user_messages(user, div_id, course_name)
        else:
            mess = "Sorry there were no good explanations for you."
            user = "nobody"
            participants = set()

    responses = {}
    for p in participants:
        responses[p] = _get_user_answer(div_id, p)
    logger.debug(f"Get message for {div_id}")
    return json.dumps(
        {"mess": mess, "user": user, "answer": peer_answer, "responses": responses}
    )


def _get_user_answer(div_id, s):
    ans = (
        db(
            (db.useinfo.event == "mChoice")
            & (db.useinfo.sid == s)
            & (db.useinfo.div_id == div_id)
            & (db.useinfo.act.like("%vote1"))
        )
        .select(orderby=~db.useinfo.id)
        .first()
    )
    # act is answer:0[,x]+:correct:voteN
    if ans:
        return ans.act.split(":")[1]
    else:
        return ""


def _get_user_messages(user, div_id, course_name):
    # this gets both sides of the conversation -- thus the | in the query below.
    messages = db(
        (db.useinfo.event == "sendmessage")
        & ((db.useinfo.sid == user) | (db.useinfo.act.like(f"to:{user}%")))
        & (db.useinfo.div_id == div_id)
        & (db.useinfo.course_id == course_name)
    ).select(orderby=db.useinfo.id)
    user = messages[0].sid
    mess = "<ul>"
    participants = set()
    for row in messages:
        mpart = row.act.split(":")[2]
        mess += f"<li>{row.sid} said: {mpart}</li>"
        participants.add(row.sid)
    mess += "</ul>"

    return mess, participants


@auth.requires(
    lambda: verifyInstructorStatus(auth.user.course_id, auth.user),
    requires_login=True,
)
def send_lti_scores():
    response.headers["content-type"] = "application/json"
    assignment_id = request.vars.assignment_id
    grades = db(db.grades.assignment == assignment_id).select()
    for sid in grades:
        _try_to_send_lti_grade(sid, assignment_id)

    return json.dumps("success")
