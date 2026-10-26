"""
Tests for the helpers that read an activecode question's code, tests and data
files from its stored source, and for the JOBE test runner. CodeTailor uses
them to check generated code against a question's own unit tests.
"""

from types import SimpleNamespace

from rsptx.book_server_api import jobe
from rsptx.book_server_api.activecode_questions import (
    data_file_candidates,
    extract_suffix_code_from_htmlsrc,
    question_test_code,
    starter_code_from_question,
)

_HTMLSRC = """\
<div data-component="activecode" id="ac_avg">
<textarea data-lang="python" data-datafile="scores.csv">
import csv
^^^^
# Return the average of nums
def average(nums):
    return sum(nums) / len(nums)
===!
print(average([1, 2, 3]))
====
from unittest.gui import TestCaseGui

class myTests(TestCaseGui):
    def testOne(self):
        self.assertEqual(average([2, 4]), 3)
        open("words.txt")
</textarea>
</div>"""


def _question(htmlsrc=_HTMLSRC, question_json=None):
    return SimpleNamespace(htmlsrc=htmlsrc, question_json=question_json)


def test_starter_code_drops_hidden_parts_and_markers():
    assert starter_code_from_question(_question()) == (
        "# Return the average of nums\n"
        "def average(nums):\n"
        "    return sum(nums) / len(nums)\n"
        "print(average([1, 2, 3]))\n"
    )


def test_starter_code_prefers_question_json():
    question = _question(question_json={"starter_code": "def f():\n    pass\n"})
    assert starter_code_from_question(question) == "def f():\n    pass\n"


def test_suffix_code_is_the_text_after_the_invisible_marker():
    assert extract_suffix_code_from_htmlsrc(_HTMLSRC).startswith(
        "from unittest.gui import TestCaseGui"
    )
    assert extract_suffix_code_from_htmlsrc("<textarea>x = 1</textarea>") == ""


def test_question_test_code_prefers_question_json():
    question = _question(question_json={"suffix_code": "import unittest"})
    assert question_test_code(question) == "import unittest"
    assert question_test_code(_question()) == extract_suffix_code_from_htmlsrc(_HTMLSRC)


def test_data_file_candidates_lists_declared_files_first():
    assert data_file_candidates(_HTMLSRC, 'open("mine.txt")') == [
        "scores.csv",
        "words.txt",
        "mine.txt",
    ]


def test_load_and_run_tests_reads_the_last_line(monkeypatch):
    runs = []

    def run(program, time_limit, data_files):
        runs.append(program)
        return "debug print\nPASS\n", ""

    monkeypatch.setattr(jobe, "run_python_program", run)
    assert jobe.load_and_run_tests("import unittest", "x = 1").wasSuccessful()
    assert runs[0].startswith('__name__ = "__runestone__"\nx = 1\n')

    monkeypatch.setattr(jobe, "run_python_program", lambda *a: ("PASS\nFAIL\n", ""))
    assert not jobe.load_and_run_tests("import unittest", "x = 1").wasSuccessful()


def test_load_and_run_tests_fails_when_jobe_does(monkeypatch):
    def run(*args):
        raise ConnectionError("JOBE is down")

    monkeypatch.setattr(jobe, "run_python_program", run)
    assert not jobe.load_and_run_tests("import unittest", "x = 1").wasSuccessful()
