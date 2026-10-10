import copy

import lxml.etree as ET
import pytest
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    JSON,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    create_engine,
    text,
)
from sqlalchemy.orm.session import sessionmaker

from rsptx.build_tools import core


def test_sample():
    assert core is not None


@pytest.mark.parametrize(
    "xml, expected",
    [
        ("<title>Plain Title</title>", "Plain Title"),
        # text before the first child is all ``.text`` returns
        (
            '<title>The <code class="code-inline tex2jax_ignore">Node</code> Class</title>',
            "The Node Class",
        ),
        # title starting with markup, where ``.text`` is None
        (
            '<title><dfn class="terminology">Optional</dfn>: Graphics in C++</title>',
            "Optional: Graphics in C++",
        ),
        ("<title>\n  Spread\n  <em>over</em>\n  lines </title>", "Spread over lines"),
        ("<title>Has <!-- a comment --> comment</title>", "Has comment"),
        ("<title/>", ""),
    ],
)
def test_title_text(xml, expected):
    assert core._title_text(ET.fromstring(xml)) == expected


def test_title_text_missing():
    assert core._title_text(None) == ""


@pytest.fixture
def page_db():
    engine = create_engine("sqlite://")
    meta = MetaData()
    questions = Table(
        "questions",
        meta,
        Column("id", Integer, primary_key=True),
        Column("base_course", String),
        Column("name", String),
        Column("timestamp", DateTime),
        Column("is_private", String),
        Column("question_type", String),
        Column("subchapter", String),
        Column("chapter", String),
        Column("from_source", String),
        Column("author", String),
        Column("owner", String),
        UniqueConstraint("name", "base_course"),
    )
    meta.create_all(engine)
    sess = sessionmaker(bind=engine)()
    yield sess, {"questions": questions, "author": "a", "owner": "o"}
    sess.close()


def _chapter_xml(subtitle, sublabel="ch1_sub1"):
    chapter = ET.fromstring(
        "<chapter><id>ch1</id><title>Linked <code>Lists</code></title>"
        f"<subchapter><id>{sublabel}</id><title>{subtitle}</title></subchapter>"
        "</chapter>"
    )
    return chapter, chapter.find("./subchapter")


def _pages(sess, db_context):
    q = db_context["questions"]
    return sess.execute(q.select().order_by(q.c.id)).fetchall()


def test_add_page_question_full_title(page_db):
    sess, db_context = page_db
    chapter, sub = _chapter_xml("The <code>Node</code> Class")
    core._add_page_question(sess, db_context, chapter, sub, "book")
    rows = _pages(sess, db_context)
    assert [(r.name, r.chapter, r.subchapter) for r in rows] == [
        ("Linked Lists/The Node Class", "ch1", "ch1_sub1")
    ]


def test_add_page_question_renames_truncated_row(page_db):
    """A row named by an older, truncating build is renamed, not orphaned."""
    sess, db_context = page_db
    q = db_context["questions"]
    sess.execute(
        q.insert().values(
            base_course="book",
            name="Linked /The ",
            question_type="page",
            chapter="ch1",
            subchapter="ch1_sub1",
        )
    )
    old_id = _pages(sess, db_context)[0].id
    chapter, sub = _chapter_xml("The <code>Node</code> Class")
    core._add_page_question(sess, db_context, chapter, sub, "book")
    rows = _pages(sess, db_context)
    assert [(r.id, r.name) for r in rows] == [(old_id, "Linked Lists/The Node Class")]


def test_add_page_question_distinct_subchapters_dont_collide(page_db):
    sess, db_context = page_db
    for label, title in [
        ("ch1_node", "The <code>Node</code> Class"),
        ("ch1_list", "The <code>Unordered Linked List</code> Class"),
    ]:
        chapter, sub = _chapter_xml(title, label)
        core._add_page_question(sess, db_context, chapter, sub, "book")
    rows = _pages(sess, db_context)
    assert [(r.name, r.subchapter) for r in rows] == [
        ("Linked Lists/The Node Class", "ch1_node"),
        ("Linked Lists/The Unordered Linked List Class", "ch1_list"),
    ]


def test_add_page_question_relabelled_page_matches_by_name(page_db):
    """A page whose labels changed but title didn't keeps its row."""
    sess, db_context = page_db
    chapter, sub = _chapter_xml("Intro", "old_label")
    core._add_page_question(sess, db_context, chapter, sub, "book")
    chapter, sub = _chapter_xml("Intro", "new_label")
    core._add_page_question(sess, db_context, chapter, sub, "book")
    rows = _pages(sess, db_context)
    assert [(r.name, r.subchapter) for r in rows] == [
        ("Linked Lists/Intro", "new_label")
    ]


def test_add_page_question_duplicate_label_rows(page_db):
    """Older builds left two page rows for one label after a title change.

    The row already carrying the current name must be the one updated;
    renaming the stale row to that name would violate the unique
    (name, base_course) constraint.
    """
    sess, db_context = page_db
    q = db_context["questions"]
    for name in ["Linked Lists/Unit 2b Projects", "Linked Lists/Unit 2B Projects"]:
        sess.execute(
            q.insert().values(
                base_course="book",
                name=name,
                question_type="page",
                chapter="ch1",
                subchapter="ch1_sub1",
            )
        )
    before = [(r.id, r.name) for r in _pages(sess, db_context)]
    chapter, sub = _chapter_xml("Unit 2B Projects")
    core._add_page_question(sess, db_context, chapter, sub, "book")
    rows = _pages(sess, db_context)
    assert [(r.id, r.name) for r in rows] == before
    assert rows[1].owner == "o"
    assert rows[0].owner is None


@pytest.fixture
def merge_db():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        for ddl in [
            "create table questions (id integer primary key, base_course text, "
            "name text, timestamp timestamp, question_type text, chapter text, "
            "subchapter text, unique (name, base_course))",
            "create table assignment_questions (id integer primary key, "
            "assignment_id integer, question_id integer, points integer)",
            "create table question_tags (id integer primary key, "
            "question_id integer, tag_id integer)",
            "create table competency (id integer primary key, question integer, "
            "competency text, question_name text)",
            "create table question_grades (id integer primary key, sid text, "
            "course_name text, div_id text, score float, "
            "unique (div_id, course_name, sid))",
            "create table courses (id integer primary key, course_name text, "
            "base_course text)",
            "insert into courses (course_name, base_course) values "
            "('book_s26', 'book'), ('other_s26', 'other')",
            # Two rows for ch1/sub1: 1 is stale (old title), 2 is current.
            "insert into questions values "
            "(1, 'book', 'Ch/Old Title', '2026-08-01', 'page', 'ch1', 'sub1'), "
            "(2, 'book', 'Ch/New Title', '2026-09-30', 'page', 'ch1', 'sub1'), "
            "(3, 'book', 'Ch/Other', '2026-08-01', 'page', 'ch1', 'sub2'), "
            "(4, 'other', 'Ch/Old Title', '2026-08-01', 'page', 'ch1', 'sub1')",
            # assignment 10 points at the stale row only; 11 at both
            "insert into assignment_questions (assignment_id, question_id, points) "
            "values (10, 1, 5), (11, 1, 5), (11, 2, 5), (12, 3, 1)",
            "insert into question_tags (question_id, tag_id) values "
            "(1, 7), (1, 8), (2, 7)",
            "insert into competency (question, competency, question_name) values "
            "(1, 'loops', 'Ch/Old Title')",
            # alice was graded under the old name only; bob under both
            "insert into question_grades (sid, course_name, div_id, score) values "
            "('alice', 'book_s26', 'Ch/Old Title', 1), "
            "('bob', 'book_s26', 'Ch/Old Title', 1), "
            "('bob', 'book_s26', 'Ch/New Title', 2), "
            "('carol', 'other_s26', 'Ch/Old Title', 3)",
        ]:
            conn.execute(text(ddl))
    yield engine
    engine.dispose()


def test_merge_duplicate_page_questions(merge_db):
    with merge_db.begin() as conn:
        report = core.merge_duplicate_page_questions(conn)
    assert len(report) == 1
    g = report[0]
    assert (g["keep_id"], g["keep_name"]) == (2, "Ch/New Title")
    assert g["dropped"] == [
        dict(
            id=1,
            name="Ch/Old Title",
            assignment_questions_moved=1,
            assignment_questions_deduped=1,
            tags_moved=1,
            competencies_moved=1,
            grades_moved=1,
            grades_conflict=1,
        )
    ]
    with merge_db.connect() as conn:
        q = lambda sql: conn.execute(text(sql)).fetchall()  # noqa: E731
        assert [r.id for r in q("select id from questions order by id")] == [2, 3, 4]
        assert q(
            "select assignment_id, question_id from assignment_questions "
            "order by assignment_id, question_id"
        ) == [(10, 2), (11, 2), (12, 3)]
        assert q("select question_id, tag_id from question_tags order by tag_id") == [
            (2, 7),
            (2, 8),
        ]
        assert q("select question, question_name from competency") == [
            (2, "Ch/New Title")
        ]
        # alice's grade follows the page; bob's stale one is left, not clobbered;
        # the other book's grade under the same name is untouched.
        assert q(
            "select sid, course_name, div_id, score from question_grades "
            "order by sid, div_id"
        ) == [
            ("alice", "book_s26", "Ch/New Title", 1),
            ("bob", "book_s26", "Ch/New Title", 2),
            ("bob", "book_s26", "Ch/Old Title", 1),
            ("carol", "other_s26", "Ch/Old Title", 3),
        ]


def test_merge_duplicate_page_questions_scoped_and_rollback(merge_db):
    with merge_db.connect() as conn:
        trans = conn.begin()
        assert core.merge_duplicate_page_questions(conn, "other") == []
        assert len(core.merge_duplicate_page_questions(conn, "book")) == 1
        trans.rollback()
        assert conn.execute(text("select count(*) from questions")).scalar() == 4


# A PreTeXt cardsort with feedback on cards, as it appears in
# runestone-manifest.xml. The empty exercise <feedback/> and the <answer/>
# elements are self-closing, as an XML serializer writes them.
CARDSORT_QUESTION = """
<question optional="yes">
  <label>Exercise 5.12.2 Cardsort Problem, Feedback on Cards.</label>
  <htmlsrc>
    <div class="ptx-runestone-container">
      <div class="runestone cardsort_section">
        <div data-component="dragndrop" data-question_label="" id="bk_cards">
          <script type="text/xml">
            <dragndrop>
              <statement>
<div class="para">Place each number in <em>one</em> category.</div></statement>
              <feedback/>
              <premise>
                <id>bk_cards_drag1</id>
                <label>
                  <span class="process-math">\\(-7\\)</span>
                </label>
              </premise>
              <premise>
                <id>bk_cards_drag2</id>
                <label><img src="generated/sqrt16.svg"/></label>
                <feedback>
<div class="para">Simplify first.</div></feedback>
              </premise>
              <premise>
                <id>bk_cards_drag3</id>
                <label>i</label>
              </premise>
              <response>
                <id>bk_cards_drop1</id>
                <label>Integer</label>
                <feedback>
<div class="para">The integers are whole.</div></feedback>
              </response>
              <response>
                <id>bk_cards_drop2</id>
                <label>Irrational</label>
              </response>
              <answer premise="bk_cards_drag1" response="bk_cards_drop1"/>
              <answer premise="bk_cards_drag2" response="bk_cards_drop1"/>
            </dragndrop>
          </script>
        </div>
      </div>
    </div>
  </htmlsrc>
</question>
"""

CARDSORT_JSON = {
    "statement": '<div class="para">Place each number in <em>one</em> category.</div>',
    "feedback": "",
    "left": [
        {"id": "bk_cards_drag1", "label": '<span class="process-math">\\(-7\\)</span>'},
        {
            "id": "bk_cards_drag2",
            "label": '<img src="generated/sqrt16.svg"/>',
            "feedback": '<div class="para">Simplify first.</div>',
        },
        {"id": "bk_cards_drag3", "label": "i"},
    ],
    "right": [
        {
            "id": "bk_cards_drop1",
            "label": "Integer",
            "feedback": '<div class="para">The integers are whole.</div>',
        },
        {"id": "bk_cards_drop2", "label": "Irrational"},
    ],
    "correctAnswers": [
        ["bk_cards_drag1", "bk_cards_drop1"],
        ["bk_cards_drag2", "bk_cards_drop1"],
    ],
}


@pytest.fixture
def question_db():
    engine = create_engine("sqlite://")
    meta = MetaData()
    questions = Table(
        "questions",
        meta,
        Column("id", Integer, primary_key=True),
        Column("base_course", String),
        Column("name", String),
        Column("timestamp", DateTime),
        Column("is_private", String),
        Column("question_type", String),
        Column("htmlsrc", String),
        Column("autograde", String),
        Column("from_source", String),
        Column("chapter", String),
        Column("subchapter", String),
        Column("topic", String),
        Column("qnumber", String),
        Column("optional", String),
        Column("practice", String),
        Column("author", String),
        Column("owner", String),
        Column("question_json", JSON),
        UniqueConstraint("name", "base_course"),
    )
    meta.create_all(engine)
    sess = sessionmaker(bind=engine)()
    yield sess, {
        "questions": questions,
        "author": "a",
        "owner": "o",
        "ext_img_patt": core.re.compile(r"""src="external"""),
        "gen_img_patt": core.re.compile(r"""src="generated"""),
    }
    sess.close()


def test_process_question_stores_dragndrop_question_json(question_db):
    sess, db_context = question_db
    chapter, sub = _chapter_xml("Cards")
    question = ET.fromstring(CARDSORT_QUESTION)
    core._process_single_question(sess, db_context, chapter, sub, question, "bk")
    q = db_context["questions"]
    row = sess.execute(q.select()).one()
    assert row.name == "bk_cards"
    assert row.question_type == "dragndrop"
    assert '<script type="text/xml">' in row.htmlsrc
    # image urls are made absolute in the JSON just as they are in htmlsrc
    expected = copy.deepcopy(CARDSORT_JSON)
    expected["left"][1][
        "label"
    ] = '<img src="/ns/books/published/bk/generated/sqrt16.svg"/>'
    assert row.question_json == expected


def test_process_question_clears_question_json_it_cannot_store(question_db):
    sess, db_context = question_db
    chapter, sub = _chapter_xml("Cards")
    core._process_single_question(
        sess, db_context, chapter, sub, ET.fromstring(CARDSORT_QUESTION), "bk"
    )
    # A later build of the book fixes the order of the cards, which
    # question_json has no place for.
    question = ET.fromstring(CARDSORT_QUESTION)
    question.find(".//*[@data-component]").set("data-random", "no")
    core._process_single_question(sess, db_context, chapter, sub, question, "bk")
    # SQL NULL, not the JSON value null
    assert (
        sess.execute(
            text("select count(*) from questions where question_json is null")
        ).scalar()
        == 1
    )
    assert db_context["question_json_stats"] == {
        ("dragndrop", True): 1,
        ("dragndrop", False): 1,
    }
