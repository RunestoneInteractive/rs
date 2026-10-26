"""Run Python programs on JOBE from the book server.

Used by CodeTailor to check the code it generates against a question's unit
tests. Data files the program opens are pushed to JOBE first, the way
livecode.js ships them with a run.
"""

import base64
import hashlib

import requests as rq

from rsptx.configuration import settings


def runestone_file_id(filename: str, content: str) -> str:
    # Exactly: "runestone" + MD5(fileName + fileContent)
    md5 = hashlib.md5((filename + content).encode("utf-8")).hexdigest()
    return "runestone" + md5


def b64_text_utf8(s: str) -> str:
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def jobe_session():
    s = rq.Session()
    s.headers["Content-type"] = "application/json; charset=utf-8"
    s.headers["Accept"] = "application/json"
    if getattr(settings, "jobe_key", None):
        s.headers["X-API-KEY"] = settings.jobe_key
    return s


def push_data_files(sess, data_files):
    """
    Upload the question's data files to JOBE so the program under test can
    open() them, mirroring how livecode.js ships datafiles with a run.
    Inputs:
        sess: requests session with the JOBE headers set
        data_files (list): dicts with "filename", "content" and "is_binary";
                           binary contents are already base64 (as stored in source_code)
    Output: list: [file_id, filename] pairs for the run_spec file_list
    """
    file_list = []
    for data_file in data_files or []:
        filename = data_file["filename"]
        content = data_file["content"]
        if data_file.get("is_binary"):
            b64 = content
        else:
            b64 = b64_text_utf8(content)
        file_id = runestone_file_id(filename, content)
        file_url = settings.jobe_server + "/jobe/index.php/restapi/files/" + file_id
        if sess.head(file_url, timeout=10).status_code != 204:
            put = sess.put(file_url, json={"file_contents": b64}, timeout=10)
            if put.status_code != 204:
                raise RuntimeError(
                    f"Failed to push data file {filename} to JOBE: {put.status_code}"
                )
        file_list.append([file_id, filename])
    return file_list


def run_python_program(program, time_limit=6, data_files=None):
    """
    Run a Python program on JOBE with the question's data files beside it.
    Returns the run's (stdout, stderr). Raises on a JOBE or network failure.
    """
    sess = jobe_session()
    runspec = {
        "language_id": "python3",
        "sourcecode": program,
        "sourcefilename": "solution.py",
        "parameters": {"timelimitsecs": time_limit},
    }
    if data_files:
        runspec["file_list"] = push_data_files(sess, data_files)
    resp = sess.post(
        settings.jobe_server + "/jobe/index.php/restapi/runs/",
        json={"run_spec": runspec},
        timeout=time_limit + 10,
    )
    result = resp.json()
    return result.get("stdout") or "", result.get("stderr") or ""


class _JobeTestResult:
    """Minimal stand-in for unittest.TestResult returned by load_and_run_tests."""

    def __init__(self, passed: bool):
        self._passed = passed

    def wasSuccessful(self) -> bool:
        return self._passed


def load_and_run_tests(unittest_case, code_to_test, time_limit=6, data_files=None):
    """
    Run Python test cases against the provided code via JOBE.

    Inputs:
        unittest_case (str): unittest source (class myTests(unittest.TestCase): ...)
        code_to_test (str): the Python solution code to validate
        time_limit (int): JOBE wall-clock time limit in seconds
        data_files (list): the question's data files to place beside the program (see push_data_files)
    Output: _JobeTestResult with wasSuccessful() method
    """
    # Suppress __main__ guards in student code — JOBE runs as top-level script
    combined = (
        '__name__ = "__runestone__"\n'
        + code_to_test
        + "\n\n"
        + unittest_case
        + "\n\nimport unittest as _ut\n"
        + "_result = _ut.main(verbosity=0, exit=False)\n"
        + 'print("PASS" if _result.result.wasSuccessful() else "FAIL")\n'
    )

    try:
        stdout, _ = run_python_program(combined, time_limit, data_files)
    except Exception:
        return _JobeTestResult(False)

    out = stdout.strip()
    # Check the last line so student debug prints don't cause false failures.
    # Trust stdout over outcome code: JOBE/Python3 may return outcome 12
    # even when tests pass.
    last_line = out.splitlines()[-1].strip() if out else ""
    return _JobeTestResult(last_line == "PASS")
