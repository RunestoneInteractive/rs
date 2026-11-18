#!/usr/bin/env python
"""Populate PTXSB with six Hogwarts students who read and do the Demo Assignment.

Every write goes through the running servers, the same way a browser would make
it, so the data lands exactly where real student activity does -- ``useinfo``,
the ``*_answers`` tables, ``question_grades`` and ``grades`` -- and is scored by
the real-time grader rather than poked into the database by hand:

1. Each student registers (``/admin/auth/register``) and enrolls in PTXSB
   (``/admin/auth/courses``).  A student who already exists just logs in, so
   the script can be re-run to pile on more activity.
2. They read their way through some of the *Runestone Testing* chapter: a page
   view, a last-page update, and a handful of interactions with the activities
   on the page (``/ns/logger/bookevent``, ``/ns/logger/runlog``).
3. They open the *Demo Assignment* and answer its questions with ``assignment_id``
   set, as ``doAssignment`` does.  A reading earns credit through
   ``/ns/logger/update_reading_score`` once enough of its page is done -- the
   same rule, and the same call, as the progress bar in the book.

How well each student does is set by their ``skill`` (chance of getting an
attempt right), ``diligence`` (share of pages read and questions attempted) and
``persistence`` (how many tries they will take at a question).  The random
choices are seeded per student, so a run is repeatable.

The database is only read, to find the chapter's pages and questions and the
assignment's readings; it is taken from ``--dburl``, else from ``DBURL`` /
``DEV_DBURL``.

    uv run python scripts/seed_ptxsb_students.py
    uv run python scripts/seed_ptxsb_students.py --base-url https://localhost --seed 7
"""

import argparse
import json
import os
import random
import re
import sys
from dataclasses import dataclass
from typing import Dict, List, Optional

import httpx
import urllib3
from sqlalchemy import create_engine, text

urllib3.disable_warnings()

COURSE = "PTXSB"
CHAPTER = "rune"
ASSIGNMENT = "Demo Assignment"
PASSWORD = "Mischief-Managed-2026"


@dataclass
class Student:
    username: str
    first_name: str
    last_name: str
    skill: float
    diligence: float
    persistence: int


STUDENTS = [
    # Reads everything and gets nearly everything right the first time.
    Student("hgranger", "Hermione", "Granger", 0.97, 1.0, 3),
    # Solid, a little rushed.
    Student("hpotter", "Harry", "Potter", 0.75, 0.8, 2),
    # Unconventional answers, but does the reading.
    Student("llovegood", "Luna", "Lovegood", 0.6, 0.9, 2),
    # Struggles but keeps trying until it works.
    Student("nlongbottom", "Neville", "Longbottom", 0.45, 0.75, 4),
    # Does about half of it, and half of that right.
    Student("rweasley", "Ron", "Weasley", 0.4, 0.5, 1),
    # Barely shows up.
    Student("vcrabbe", "Vincent", "Crabbe", 0.15, 0.25, 1),
]


# ---------------------------------------------------------------------------
# What the book and assignment look like
# ---------------------------------------------------------------------------


def load_course_facts(dburl: str) -> dict:
    """Read the chapter's pages and questions and the assignment from the db."""
    eng = create_engine(dburl)
    with eng.connect() as conn:
        subchapters = [
            r.sub_chapter_label
            for r in conn.execute(
                text(
                    """select s.sub_chapter_label from sub_chapters s
                       join chapters c on c.id = s.chapter_id
                       where c.course_id = :course and c.chapter_label = :chap
                       order by s.sub_chapter_num"""
                ),
                dict(course=COURSE, chap=CHAPTER),
            )
        ]
        questions = [
            dict(r._mapping)
            for r in conn.execute(
                text(
                    """select id, name, question_type, subchapter, optional, htmlsrc
                       from questions
                       where base_course = :course and chapter = :chap
                         and from_source = 'T' and question_type != 'page'
                       order by id"""
                ),
                dict(course=COURSE, chap=CHAPTER),
            )
        ]
        assignment = conn.execute(
            text(
                """select a.id from assignments a join courses c on c.id = a.course
                   where c.course_name = :course and a.name = :name"""
            ),
            dict(course=COURSE, name=ASSIGNMENT),
        ).first()
        if not assignment:
            sys.exit(f"No assignment named {ASSIGNMENT!r} in {COURSE}")
        assigned = [
            dict(r._mapping)
            for r in conn.execute(
                text(
                    """select q.id, q.name, q.question_type, q.chapter, q.subchapter,
                              q.htmlsrc, aq.points, aq.activities_required,
                              aq.reading_assignment
                       from assignment_questions aq
                       join questions q on q.id = aq.question_id
                       where aq.assignment_id = :aid
                       order by aq.sorting_priority"""
                ),
                dict(aid=assignment.id),
            )
        ]
        # A real SPLICE state per activity, so the grader has something it can
        # restore when an instructor looks at the seeded answer.
        splice_states = {
            r.div_id: r.answer
            for r in conn.execute(
                text(
                    """select distinct on (div_id) div_id, answer
                       from splice_answers order by div_id, id desc"""
                )
            )
        }
    return dict(
        subchapters=subchapters,
        questions=questions,
        assignment_id=assignment.id,
        assigned=assigned,
        splice_states=splice_states,
    )


def mchoice_key(htmlsrc: str):
    """The option count and the indices of the correct options."""
    options = re.findall(r'<li[^>]*data-component="answer"[^>]*>', htmlsrc or "")
    correct = [i for i, li in enumerate(options) if "data-correct" in li]
    multi = 'data-multipleanswers="true"' in (htmlsrc or "")
    return max(len(options), 2), correct or [0], multi


def parsons_block_count(htmlsrc: str) -> int:
    return max(len(re.findall(r"^---\s*$", htmlsrc or "", flags=re.M)) + 1, 2)


def dnd_pairs(div_id: str, htmlsrc: str):
    """(dropzone, draggable) pairs that make up the correct answer.

    Dropzones are named after the draggable that belongs in them, ``*_dragX``
    going in ``*_dropX``, which is how the component keys its answer.
    """
    drags = re.findall(rf'id="{re.escape(div_id)}_drag([^"]+)"', htmlsrc or "")
    pairs = [(f"{div_id}_drop{x}", f"{div_id}_drag{x}") for x in drags]
    return pairs or [(f"{div_id}_drop1", f"{div_id}_drag1")]


def fitb_blank_count(htmlsrc: str) -> int:
    m = re.search(r'"blankNames":\s*(\{[^}]*\})', htmlsrc or "")
    try:
        return max(len(json.loads(m.group(1))), 1) if m else 1
    except ValueError:
        return 1


def has_unit_tests(name: str, htmlsrc: str) -> bool:
    # hello-world's test is added in the book source but does not show in the
    # stored htmlsrc; it is the one assigned in the Demo Assignment.
    return "unittest" in (htmlsrc or "") or name.endswith("_hello-world")


# ---------------------------------------------------------------------------
# A student at the keyboard
# ---------------------------------------------------------------------------


class Session:
    def __init__(self, base_url: str, student: Student, facts: dict, rng):
        self.s = student
        self.facts = facts
        self.rng = rng
        self.http = httpx.Client(base_url=base_url, verify=False, timeout=60)
        self.assignment_id: Optional[int] = None
        self.touched: Dict[str, set] = {}  # subchapter -> div_ids interacted with
        self.log: List[str] = []

    # -- account --------------------------------------------------------------

    def register_or_login(self):
        s = self.s
        r = self.http.post(
            "/admin/auth/register",
            data=dict(
                username=s.username,
                first_name=s.first_name,
                last_name=s.last_name,
                email=f"{s.username}@hogwarts.example.edu",
                password=PASSWORD,
                password2=PASSWORD,
                institution="Hogwarts",
            ),
        )
        if r.status_code == 302:
            self.log.append("registered")
        else:
            r = self.http.post(
                "/admin/auth/login",
                data=dict(username=s.username, password=PASSWORD),
            )
            if r.status_code != 302:
                raise RuntimeError(
                    f"{s.username}: could not register or log in ({r.status_code})"
                )
            self.log.append("logged in")
        r = self.http.post("/admin/auth/courses", data=dict(direct_course=COURSE))
        if r.status_code != 302:
            raise RuntimeError(f"{s.username}: enrollment in {COURSE} failed")

    # -- low level ------------------------------------------------------------

    def event(self, subchapter: str, **fields):
        payload = dict(
            course_name=COURSE,
            clientLoginStatus=True,
            timezoneoffset=5,
            chapter=CHAPTER,
            subchapter=subchapter,
            **fields,
        )
        if self.assignment_id:
            payload["assignment_id"] = self.assignment_id
        r = self.http.post("/ns/logger/bookevent", json=payload)
        if r.status_code >= 300:
            raise RuntimeError(
                f"{self.s.username}: bookevent {fields.get('event')} "
                f"{fields.get('div_id')} -> {r.status_code} {r.text[:200]}"
            )
        self.touched.setdefault(subchapter, set()).add(
            fields.get("selector_id") or fields["div_id"]
        )
        return r.json().get("detail")

    def runlog(self, div_id: str, code: str, lang: str = "python"):
        self.http.post(
            "/ns/logger/runlog",
            json=dict(
                div_id=div_id,
                code=code,
                errinfo="success",
                to_save=True,
                course=COURSE,
                clientLoginStatus=True,
                timezoneoffset=5,
                language=lang,
            ),
        )

    def view_page(self, subchapter: str):
        page = f"{subchapter}.html"
        self.http.get(f"/ns/books/published/{COURSE}/{page}")
        self.event(subchapter, event="page", act="view", div_id=page)
        self.http.post(
            "/ns/logger/updatelastpage",
            json=dict(
                lastPageUrl=f"/ns/books/published/{COURSE}/{page}",
                course=COURSE,
                completionFlag=1 if self.rng.random() < self.s.diligence else 0,
                pageLoad=True,
                markingComplete=False,
                markingIncomplete=False,
                lastPageScrollLocation=self.rng.randint(0, 4000),
                isPtxBook=True,
            ),
        )

    def attempts(self):
        """Yield (attempt number, is_correct) until right or out of patience."""
        for n in range(self.s.persistence):
            # Each retry is a little better informed than the last.
            ok = self.rng.random() < min(1.0, self.s.skill + 0.12 * n)
            yield n, ok
            if ok:
                return

    # -- one question, by type ------------------------------------------------

    def do_question(self, q: dict, selector_id: Optional[str] = None):
        name, qtype, sub = q["name"], q["question_type"], q["subchapter"]
        extra = dict(selector_id=selector_id) if selector_id else {}
        handler = getattr(self, f"_do_{qtype}", None)
        if handler is None:
            return None
        return handler(name, sub, q, extra)

    def _do_mchoice(self, name, sub, q, extra):
        n_opts, correct, multi = mchoice_key(q["htmlsrc"])
        wrong = [i for i in range(n_opts) if i not in correct] or [0]
        for _, ok in self.attempts():
            if ok:
                ans = correct if multi else [correct[0]]
            else:
                ans = sorted(self.rng.sample(wrong, 1))
            ans_s = ",".join(str(a) for a in ans)
            self.event(
                sub,
                event="mChoice",
                div_id=name,
                act=f"answer:{ans_s}:{'correct' if ok else 'no'}",
                answer=ans_s,
                correct=ok,
                percent=1.0 if ok else 0.0,
                **extra,
            )
        return ok

    def _do_fillintheblank(self, name, sub, q, extra):
        blanks = fitb_blank_count(q["htmlsrc"])
        for _, ok in self.attempts():
            if ok:
                right = blanks
            else:
                right = self.rng.randint(0, blanks - 1) if blanks > 1 else 0
            answer = json.dumps(["magic"] * right + ["muggle"] * (blanks - right))
            self.event(
                sub,
                event="fillb",
                div_id=name,
                act=answer,
                answer=answer,
                correct=ok,
                percent=right / blanks,
                **extra,
            )
        return ok

    def _do_dragndrop(self, name, sub, q, extra):
        pairs = dnd_pairs(name, q["htmlsrc"])
        for _, ok in self.attempts():
            drags = [d for _, d in pairs]
            if not ok and len(drags) > 1:
                # Swap two to get a partly right answer.
                i, j = self.rng.sample(range(len(drags)), 2)
                drags[i], drags[j] = drags[j], drags[i]
            for (drop, _), drag in zip(pairs, drags):
                self.event(
                    sub, event="dragNdrop-drop", div_id=name, act=f"{drag} -> {drop}"
                )
            right = sum(1 for (_, d), g in zip(pairs, drags) if d == g)
            answer = json.dumps({drop: [g] for (drop, _), g in zip(pairs, drags)})
            ok = right == len(pairs)
            self.event(
                sub,
                event="dragNdrop",
                div_id=name,
                act=answer,
                answer=answer,
                min_height=240,
                correct=ok,
                percent=right / len(pairs),
                **extra,
            )
        return ok

    def _do_parsonsprob(self, name, sub, q, extra):
        n = parsons_block_count(q["htmlsrc"])
        for _, ok in self.attempts():
            order = list(range(n))
            if not ok:
                while order == list(range(n)):
                    self.rng.shuffle(order)
            answer = "-".join(f"{i}_0" for i in order)
            self.event(sub, event="parsonsMove", div_id=name, act=f"move|-|{answer}|c0")
            self.event(
                sub,
                event="parsons",
                div_id=name,
                act=f"{'correct' if ok else 'incorrect'}|-|{answer}",
                answer=answer,
                source="-",
                correct=ok,
                percent=1.0 if ok else 0.0,
                **extra,
            )
        return ok

    def _do_activecode(self, name, sub, q, extra):
        lang = "python"
        m = re.search(r'data-lang="(\w+)"', q["htmlsrc"] or "")
        if m:
            lang = m.group(1)
        has_tests = has_unit_tests(name, q["htmlsrc"])
        ok = False
        for n, ok in self.attempts():
            self.runlog(name, f"# attempt {n + 1} by {self.s.first_name}\n", lang)
            self.event(sub, event="activecode", div_id=name, act="run", **extra)
            if has_tests:
                pct = 100 if ok else self.rng.choice([0, 0, 50])
                passed = 1 if ok else 0
                self.event(
                    sub,
                    event="unittest",
                    div_id=name,
                    act=f"percent:{pct}:passed:{passed}:failed:{1 - passed}",
                    **extra,
                )
            elif not ok:
                self.event(
                    sub,
                    event="ac_error",
                    div_id=name,
                    act="SyntaxError: bad input on line 3",
                )
        return ok

    def _do_splice(self, name, sub, q, extra):
        state = self.facts["splice_states"].get(name, {})
        ok = False
        for _, ok in self.attempts():
            score = 1.0 if ok else round(self.rng.choice([0, 1 / 3, 0.5, 2 / 3]), 4)
            self.event(sub, event="SPLICE.sendEvent", div_id=name, act="isVisible")
            self.event(
                sub,
                event="SPLICE.reportScoreAndState",
                div_id=name,
                act=f"score: {score}",
                answer=json.dumps(state),
                percent=score,
                correct=score == 1.0,
                **extra,
            )
        return ok

    _do_doenet = _do_splice
    _do_iframe = _do_splice

    def _do_selectquestion(self, name, sub, q, extra):
        # A toggle: look at the choices, then answer the one shown.
        options = re.search(r'data-questionlist="([^"]+)"', q["htmlsrc"] or "")
        choices = [c.strip() for c in options.group(1).split(",")] if options else []
        by_name = {qq["name"]: qq for qq in self.facts["questions"]}
        real = [by_name[c] for c in choices if c in by_name] or []
        if not real:
            return None
        pick = self.rng.choice(real)
        self.event(sub, event="select_toggle", div_id=name, act=pick["name"])
        result = self.do_question(pick, selector_id=name)
        self.event(sub, event="selectquestion", div_id=name, act="interaction")
        return result

    def _do_codelens(self, name, sub, q, extra):
        for act in ["fwd"] * self.rng.randint(2, 6) + ["back"]:
            self.event(sub, event="codelens", div_id=name, act=act)
        return True

    def _do_youtube(self, name, sub, q, extra):
        t = round(self.rng.uniform(20, 240), 2)
        self.event(sub, event="video", div_id=name, act="play:0.01")
        self.event(sub, event="video", div_id=name, act=f"pause:{t}")
        return True

    def _do_shortanswer(self, name, sub, q, extra):
        text_ = self.rng.choice(
            [
                "I think it depends on the input size.",
                "Because the loop runs once for every item.",
                "Not sure, but probably the second one.",
                "It's like a Remembrall for variables.",
            ]
        )
        self.event(sub, event="shortanswer", div_id=name, act=text_, answer=text_)
        return True

    # -- the two activities ---------------------------------------------------

    def read_chapter(self):
        """Wander through the Runestone Testing chapter."""
        by_sub: Dict[str, list] = {}
        for q in self.facts["questions"]:
            by_sub.setdefault(q["subchapter"], []).append(q)
        read = 0
        for sub in self.facts["subchapters"]:
            if self.rng.random() > self.s.diligence:
                continue
            self.view_page(sub)
            read += 1
            for q in by_sub.get(sub, []):
                if self.rng.random() < self.s.diligence:
                    self.do_question(q)
        self.log.append(f"read {read}/{len(self.facts['subchapters'])} pages")

    def do_assignment(self):
        aid = self.facts["assignment_id"]
        self.http.get(
            "/assignment/student/doAssignment", params=dict(assignment_id=aid)
        )
        self.assignment_id = aid
        by_sub: Dict[str, list] = {}
        for q in self.facts["questions"]:
            by_sub.setdefault(q["subchapter"], []).append(q)

        tried = right = 0
        readings = []
        for q in self.facts["assigned"]:
            if q["question_type"] == "page":
                readings.append(q)
                continue
            if self.rng.random() > self.s.diligence:
                continue
            tried += 1
            if self.do_question(q):
                right += 1

        for q in readings:
            if self.rng.random() > self.s.diligence:
                continue
            sub = q["subchapter"]
            self.view_page(sub)
            # Work through the page's activities until bored.
            for qq in by_sub.get(sub, []):
                if qq["optional"] == "T":
                    continue
                if self.rng.random() < self.s.diligence:
                    self.do_question(qq)
            required = q["activities_required"] or 0
            done = 1 + len(
                {qq["name"] for qq in by_sub.get(sub, []) if qq["optional"] != "T"}
                & self.touched.get(sub, set())
            )
            if done >= required:
                self.http.post(
                    "/ns/logger/update_reading_score",
                    json=dict(
                        activities_required=required,
                        question_id=q["id"],
                        assignment_id=aid,
                        points=q["points"],
                        name=q["name"],
                    ),
                )
            self.log.append(f"{q['name']}: {done}/{required} activities")
        self.assignment_id = None
        self.log.append(f"assignment: {right}/{tried} questions right")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base-url", default="https://localhost")
    ap.add_argument("--dburl", default=None)
    ap.add_argument("--seed", type=int, default=1997, help="random seed")
    args = ap.parse_args()

    dburl = args.dburl or os.environ.get("DBURL") or os.environ.get("DEV_DBURL")
    if not dburl:
        sys.exit("Set --dburl, DBURL or DEV_DBURL")
    facts = load_course_facts(dburl)

    for student in STUDENTS:
        rng = random.Random(f"{args.seed}-{student.username}")
        sess = Session(args.base_url, student, facts, rng)
        sess.register_or_login()
        sess.read_chapter()
        sess.do_assignment()
        print(f"{student.first_name} {student.last_name} ({student.username})")
        for line in sess.log:
            print(f"    {line}")

    print(f"\nAll students use the password {PASSWORD!r}.")


if __name__ == "__main__":
    main()
