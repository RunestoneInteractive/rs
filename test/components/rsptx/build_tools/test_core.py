import lxml.etree as ET
import pytest
from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, create_engine
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
