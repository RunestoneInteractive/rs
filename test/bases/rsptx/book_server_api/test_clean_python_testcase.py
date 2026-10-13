"""
Tests for clean_python_testcase, which turns a question's test code into
something CodeTailor can run on JOBE.

CodeTailor appends its own runner and reads a final PASS line. A runner call
left in the test code (unittest.main() exits the program) ran the tests first
and exited, so no PASS printed and every generated solution fell back to the
example solution.
"""

import pytest

from rsptx.book_server_api.routers.coach import clean_python_testcase

_TESTS = """\
import unittest

class myTests(unittest.TestCase):

    def testOne(self):
        self.assertEqual(find_lowest_close()[1], "1-Feb-89")
"""


@pytest.mark.parametrize(
    "runner",
    ["unittest.main()", "unittest.main(verbosity=2)", "myTests().main()"],
)
def test_runner_call_is_removed(runner):
    cleaned = clean_python_testcase(_TESTS + "\n" + runner + "\n")
    assert ".main(" not in cleaned
    assert "def testOne(self):" in cleaned


def test_browser_style_tests_become_unittest():
    raw = (
        "from unittest.gui import TestCaseGui\n"
        "class myTests(TestCaseGui):\n"
        "    def testOne(self):\n"
        "        self.assertTrue(True)\n"
        "myTests().main()\n"
    )
    cleaned = clean_python_testcase(raw)
    assert "import unittest\n" in cleaned
    assert "class myTests(unittest.TestCase):" in cleaned
    assert ".main(" not in cleaned
