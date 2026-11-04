"""
A Java test run that never reaches JOBE's verdict must count as failing.
"""

from types import SimpleNamespace

from rsptx.book_server_api.routers.personalized_parsons import evaluate_fixed_code

_JAVA = "public class Main {\n    public static int one() { return 1; }\n}"
_TESTS = "public class MainTest extends CodeTestHelper {\n}"


class _FakeSession:
    def __init__(self, put_status=204, run_body=None):
        self.headers = {}
        self.put_status = put_status
        self.run_body = run_body

    def head(self, url, timeout=None):
        return SimpleNamespace(status_code=404)

    def put(self, url, json=None, timeout=None):
        return SimpleNamespace(status_code=self.put_status, text="nope")

    def post(self, url, json=None, timeout=None):
        def bad_json():
            raise ValueError("not json")

        return SimpleNamespace(status_code=502, text=self.run_body, json=bad_json)


def _use_session(monkeypatch, session):
    monkeypatch.setattr(evaluate_fixed_code.rq, "Session", lambda: session)


def test_failed_file_push_is_a_failure(monkeypatch):
    _use_session(monkeypatch, _FakeSession(put_status=500))
    assert evaluate_fixed_code.load_and_run_java_tests(_JAVA, _TESTS) is False
    passed, _ = evaluate_fixed_code.java_unittest_evaluation(_JAVA, "", "", _TESTS)
    assert passed is False


def test_non_json_reply_is_a_failure(monkeypatch):
    _use_session(monkeypatch, _FakeSession(run_body="<html>Bad Gateway</html>"))
    assert evaluate_fixed_code.load_and_run_java_tests(_JAVA, _TESTS) is False
