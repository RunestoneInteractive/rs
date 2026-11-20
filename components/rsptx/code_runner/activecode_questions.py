"""Read an activecode question's code, tests and data files from the database.

CodeTailor uses these to check generated code against a question's own unit
tests on JOBE, with the files the question's program opens shipped alongside.
They split a question's source the way activecode.js does in the browser.
"""

import html
import re

from rsptx.db.crud import fetch_source_code
from rsptx.db.crud.question import fetch_question
from rsptx.logging import rslogger


async def find_question(name, basecourse):
    """
    The question named ``name``, or None. Question names are unique only
    within a base course, so look in ``basecourse`` first. A cloned course
    keeps the original book's base_course on its question rows, and
    selectquestion can pull an exercise from another book, so fall back to a
    global name match -- the same resolution get_question_source and /htmlsrc
    use.
    """
    question = await fetch_question(name, basecourse=basecourse) if basecourse else None
    if question:
        return question
    question = await fetch_question(name)
    if question and basecourse:
        rslogger.warning(
            f"'{name}' not in base course '{basecourse}' "
            f"(likely a cloned course); resolved via global name match"
        )
    return question


def clean_python_testcase(raw_test_code: str) -> str:
    """
    Transform Runestone browser-style test code to standard unittest format.
    Mirrors the cleanTestcase() transformation in activecode.js so that
    suffix_code from the DB can be run by JOBE (which has no unittest.gui).
    """
    result = re.sub(
        r"from unittest\.gui import TestCaseGui\s*\n",
        "import unittest\n",
        raw_test_code,
    )
    result = result.replace(
        "class myTests(TestCaseGui):", "class myTests(unittest.TestCase):"
    )
    # A test file's own runner call (myTests().main() or unittest.main(...))
    # exits before JOBE's PASS line prints, which reads as a failed test.
    result = re.sub(
        r"^\s*(?:myTests\(\)|unittest)\.main\(.*\)\s*$",
        "",
        result,
        flags=re.MULTILINE,
    )
    return result


# Activecode source markers, matched the way activecode.js matches them: the
# first occurrence anywhere, newline or not. The invisible (test) suffix is
# four or more "=" -- activecode.js accepts "=====" and longer from older
# books -- and the invisible prefix four or more "^". "===!" and "^^^!" mark
# visible suffixes and prefixes, which stay in the editor.
_INVISIBLE_SUFFIX_RE = re.compile(r"={4,}")
_INVISIBLE_PREFIX_RE = re.compile(r"\^{4,}")
_VISIBLE_SUFFIX = "===!"
_VISIBLE_PREFIX = "^^^!"


def _drop_marker(text, marker):
    """Remove the first ``marker`` and the newline right after it, if any."""
    start = text.find(marker)
    if start == -1:
        return text
    end = start + len(marker)
    if text[end : end + 1] == "\n":
        end += 1
    return text[:start] + text[end:]


def extract_suffix_code_from_htmlsrc(htmlsrc):
    """
    Book-authored activecode questions never get question_json.suffix_code
    populated by the build pipeline (only instructor-authored custom
    exercises do) -- their test code instead lives in the raw <textarea>
    source, after a "====" (or longer) or "===!" delimiter line, same
    convention used by build_tools/core.py::_determine_autograde.
    """
    if not htmlsrc:
        return ""
    match = re.search(r"<textarea[^>]*>(.*?)</textarea>", htmlsrc, flags=re.DOTALL)
    text = html.unescape(match.group(1) if match else htmlsrc)
    marker = _INVISIBLE_SUFFIX_RE.search(text)
    if marker:
        return text[marker.end() :].strip()
    if _VISIBLE_SUFFIX in text:
        return text.partition(_VISIBLE_SUFFIX)[2].strip()
    return ""


def question_test_code(question):
    """
    The question's unit tests: a custom exercise's question_json.suffix_code,
    or for a book-authored question (whose question_json has none) the tests
    parsed out of the raw textarea source.
    """
    return (question.question_json or {}).get(
        "suffix_code"
    ) or extract_suffix_code_from_htmlsrc(question.htmlsrc)


def starter_code_from_question(question):
    """
    The code a student sees in the editor before changing anything: a custom
    exercise's question_json.starter_code, or for a book-authored question the
    activecode <textarea> source split the way activecode.js splits it -- the
    invisible "^^^^" prefix and "====" test suffix removed, and the "^^^!" and
    "===!" markers dropped while their visible code stays.
    """
    starter = (question.question_json or {}).get("starter_code")
    if starter is not None:
        return starter
    match = re.search(
        r"<textarea[^>]*>(.*?)</textarea>", question.htmlsrc or "", flags=re.DOTALL
    )
    if not match:
        return ""
    text = html.unescape(match.group(1))
    prefix = _INVISIBLE_PREFIX_RE.search(text)
    if prefix:
        text = _drop_marker(text[prefix.start() :], prefix.group(0))
    text = _drop_marker(text, _VISIBLE_PREFIX)
    suffix = _INVISIBLE_SUFFIX_RE.search(text)
    if suffix:
        text = text[: suffix.start()]
    return _drop_marker(text, _VISIBLE_SUFFIX)


# A quoted name with a file extension, e.g. open("scores.csv") or
# new File("words.txt") -- a possible data file to look up in source_code.
# Single spaces inside the name are allowed, since uploaded datafiles keep
# theirs (open("my data.csv")).
_FILENAME_LITERAL_RE = re.compile(
    r"""["']([\w\-./]+(?: [\w\-./]+)*\.[A-Za-z0-9]{1,8})["']"""
)
# Bounds the source_code lookups that guessed filename literals can trigger.
# Names the question declares in data-datafile are always kept.
_MAX_DATA_FILE_CANDIDATES = 20


def data_file_candidates(htmlsrc, *code_sources):
    """
    Filenames the question's program may open. Livecode (JOBE) questions list
    them in data-datafile, but Python questions don't declare them anywhere --
    Skulpt resolves open() at runtime -- so also take every quoted
    filename-like literal from the question's code, its tests and the
    student's code. Names that turn out not to be data files simply miss in
    the source_code lookup.
    """
    declared = []
    htmlsrc = htmlsrc or ""
    match = re.search(r'data-datafile\s*=\s*"([^"]*)"', htmlsrc)
    if match:
        declared.extend(name.strip() for name in match.group(1).split(","))
    declared = list(dict.fromkeys(name for name in declared if name))
    textarea = re.search(r"<textarea[^>]*>(.*?)</textarea>", htmlsrc, flags=re.DOTALL)
    question_code = html.unescape(textarea.group(1)) if textarea else ""
    inferred = []
    for text in (question_code, *code_sources):
        inferred.extend(_FILENAME_LITERAL_RE.findall(text or ""))
    inferred = [name for name in dict.fromkeys(inferred) if name not in declared]
    return declared + inferred[:_MAX_DATA_FILE_CANDIDATES]


async def fetch_data_files(candidates, course_scopes):
    """
    Resolve candidate filenames against source_code -- the same store
    Skulpt's file reader and livecode.js fall back to -- so the files can be
    shipped to JOBE with every test run.

    course_scopes is a list of (base_course, course_name) pairs tried in
    order: the requesting course first, then the book the question came from
    (which differs for cloned courses and cross-book selectquestions).
    Returns dicts in the shape jobe.push_data_files expects.
    """
    data_files = []
    for name in candidates:
        for base_course, course_name in course_scopes:
            try:
                row = await fetch_source_code(
                    base_course=base_course, course_name=course_name, filename=name
                )
            except Exception:
                # fetch_source_code raises when nothing matches
                row = None
            if row and row.main_code is not None:
                filename = row.filename or name
                # data-datafile names the acid while the code names the file,
                # so the same file can be resolved twice -- ship it once
                if filename not in {data_file["filename"] for data_file in data_files}:
                    data_files.append(
                        {
                            "filename": filename,
                            "content": row.main_code,
                            "is_binary": bool(row.is_binary),
                        }
                    )
                break
    return data_files
