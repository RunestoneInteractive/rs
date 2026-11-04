import re
import difflib
import requests as rq
import hashlib
import base64
import json
from ..rsproxy import settings
from rsptx.code_runner.jobe import (
    b64_text_utf8,
    load_and_run_tests,
    push_data_files,
)


def _ensure_file_on_jobe(
    sess: rq.Session, base_host: str, file_id: str, content: str
) -> None:
    """
    Mirrors JS logic:
      - HEAD /jobeCheckFile/<id>
        * 204 => already present (no upload)
        * 404 or 208 => upload via PUT
      - PUT /jobePushFile/<id> with {"file_contents": base64(content)}
        * expects 204 on success
    """
    check_url = base_host + CHECK_PROXY + file_id
    r = sess.head(check_url, timeout=10)

    if r.status_code == 204:
        return  # already there

    if r.status_code not in (404, 208):
        raise RuntimeError(
            f"Unexpected HEAD status from JOBE checkFile: {r.status_code} {r.text[:300]}"
        )

    put_url = base_host + PUSH_PROXY + file_id
    payload = {"file_contents": b64_text_utf8(content)}
    pr = sess.put(
        put_url,
        data=json.dumps(payload),
        headers={"Content-type": "application/json", "Accept": "text/plain"},
        timeout=10,
    )
    if pr.status_code != 204:
        raise RuntimeError(
            f"Failed to push file to JOBE: {pr.status_code} {pr.text[:300]}"
        )


# Match what the JS client uses
PUSH_PROXY = "/ns/rsproxy/jobePushFile/"
CHECK_PROXY = "/ns/rsproxy/jobeCheckFile/"


# modified from rsproxy.py and livecode.js logic
def load_and_run_java_tests(java_code, test_code, data_files=None):
    """
    Compile and run Java code with test cases.
    Inputs:
        java_code (str): The Java code to be tested.
        test_code (str): The Java test cases -- a JUnit test class (extends CodeTestHelper,
                         methods annotated with @Test, no main()), matching the standard
                         Runestone suffix_code convention used for regular activecode runs.
        data_files (list): the question's data files to place beside the program (see jobe.push_data_files)
    Output: bool: True if all tests pass, False otherwise.
    """

    def extract_class_name(code):
        match = re.search(r"public\s+class\s+(\w+)", code)
        if match:
            return match.group(1)
        else:
            raise ValueError("Could not find a public class declaration.")

    student_class = extract_class_name(java_code)
    test_class = extract_class_name(test_code)

    student_filename = f"{student_class}.java"
    test_filename = f"{test_class}.java"

    # Runestone-style file ids: "runestone" + md5(filename + content)
    student_id = (
        "runestone"
        + hashlib.md5((student_filename + java_code).encode("utf-8")).hexdigest()
    )
    test_id = (
        "runestone"
        + hashlib.md5((test_filename + test_code).encode("utf-8")).hexdigest()
    )

    runs_url = settings.jobe_server + "/jobe/index.php/restapi/runs/"
    student_file_url = (
        settings.jobe_server + "/jobe/index.php/restapi/files/" + student_id
    )
    test_file_url = settings.jobe_server + "/jobe/index.php/restapi/files/" + test_id

    sess = rq.Session()
    sess.headers["Content-type"] = "application/json; charset=utf-8"
    sess.headers["Accept"] = "application/json"
    if getattr(settings, "jobe_key", None):
        sess.headers["X-API-KEY"] = settings.jobe_key

    # base64 encode content for JOBE file store ---
    student_b64 = base64.b64encode(java_code.encode("utf-8")).decode("ascii")
    test_b64 = base64.b64encode(test_code.encode("utf-8")).decode("ascii")

    try:
        r = sess.head(student_file_url, timeout=10)
        if r.status_code != 204:
            # if not found (typically 404), push it
            put = sess.put(
                student_file_url, json={"file_contents": student_b64}, timeout=10
            )
            if put.status_code != 204:
                return False

        r = sess.head(test_file_url, timeout=10)
        if r.status_code != 204:
            put = sess.put(test_file_url, json={"file_contents": test_b64}, timeout=10)
            if put.status_code != 204:
                return False

        data_file_list = push_data_files(sess, data_files)

        # Mirrors livecode.js: run the JUnit test class via JUnitCore rather than
        # calling a main() the test class doesn't have.
        runner_code = f"""import org.junit.runner.JUnitCore;
        import org.junit.runner.Result;

        public class TestRunner {{
            public static void main(String[] args) {{
                CodeTestHelper.resetFinalResults();
                Result result = JUnitCore.runClasses({test_class}.class);
                System.out.println(result.wasSuccessful() ? "PASS" : "FAIL");
            }}
        }}"""

        runspec = {
            "language_id": "java",
            "sourcecode": runner_code,
            "sourcefilename": "",
            # RunestoneTests/CodeTestHelper only reference the student class by name
            # (reflectively, at runtime), so javac never sees a static reference to it
            # and won't compile it unless told to explicitly -- mirrors livecode.js,
            # which pushes the student filename onto compileargs for the same reason.
            "parameters": {"compileargs": [student_filename]},
            "file_list": [
                [student_id, student_filename],
                [test_id, test_filename],
            ]
            + data_file_list,
        }

        resp = sess.post(runs_url, json={"run_spec": runspec}, timeout=10)

        try:
            result = resp.json()
        except Exception:
            return False

        out = (result.get("stdout") or "").strip()
        passed = (result.get("outcome") == 15) and out.startswith("PASS")
        return passed

    except Exception:
        return False


def fix_indentation(text):
    lines = text.split("\n")

    # Remove leading whitespace for the first line
    if lines:
        lines[0] = lines[0].lstrip()

    # Find the indentation of the first def/class line
    indentation = 0
    for line in lines:
        if line.strip().startswith(("def ", "class ")):
            indentation = len(line) - len(line.lstrip())
            break

    # Remove indentation for subsequent lines
    for i in range(1, len(lines)):
        lines[i] = lines[i][indentation:]

    return "\n".join(lines)


def contain_default_starting_code(default_code, code, similarity_threshold=0.95):
    if default_code is None or default_code != default_code:  # NaN check
        return True
    else:
        # Remove leading whitespace from each line in the subset and code
        default_code = "\n".join(
            line.lstrip() for line in default_code.split("\n") if line.strip()
        )
        code_stripped = "\n".join(
            line.lstrip() for line in code.split("\n") if line.strip()
        )
        # Remove whitespace within strings
        default_code_no_whitespace = re.sub(r"(?<=\S)\s+(?=\S)", "", default_code)
        code_stripped_no_whitespace = re.sub(r"(?<=\S)\s+(?=\S)", "", code_stripped)

        if default_code_no_whitespace in code_stripped_no_whitespace:
            return True
        else:
            default_lines = [
                line.lstrip() for line in default_code.split("\n") if line.strip()
            ]
            code_lines = [line.lstrip() for line in code.split("\n") if line.strip()]
            code_before_last_default_code_line = code_lines[
                : code_lines.index(default_lines[-1])
            ]
            # Calculate similarity ratio using difflib
            similarity_ratio = difflib.SequenceMatcher(
                None, default_lines, code_before_last_default_code_line
            ).ratio()
            return similarity_ratio >= similarity_threshold


def extract_code_line(code):
    fixed_pattern = r"\[fixed-code\]:\s*([\s\S]*)"

    if re.findall(fixed_pattern, code, re.DOTALL):
        fixed_code = re.findall(fixed_pattern, code, re.DOTALL)[0].strip()
        # if the content inside of [fixed-code] does not start with def
    else:
        fixed_code = code

    fenced_pattern = r"```(.*?)```"

    if re.findall(fenced_pattern, fixed_code, flags=re.DOTALL):
        extracted_content = re.findall(fenced_pattern, fixed_code, flags=re.DOTALL)
        fixed_code = "\n".join(extracted_content)
    else:
        fixed_code = fixed_code

    if not fixed_code.startswith(("def", "import", "class")):
        if re.findall(r"(?:def|public|class|import)(.*)", fixed_code, re.DOTALL):
            match = re.search(r"(public|class|import|def)", fixed_code)
            if match:
                fixed_code = fixed_code[match.start() :]
        else:
            fixed_code = fixed_code
    else:
        fixed_code = fixed_code

    return fixed_code


def remove_default_testline(code, default_test_code):
    # Split the lines to remove by newline
    default_test_code_list = default_test_code.strip().split("\n")
    # remove the leading whitespace in front of each item in default_test_code_list
    default_test_code_list = [line.lstrip() for line in default_test_code_list]
    # Remove the lines from the code snippet
    modified_code_snippet = ""
    for line in code.strip().split("\n"):
        if (
            (line.strip() not in default_test_code_list)
            & ("print" not in line)
            & (not line.startswith("#"))
        ):
            modified_code_snippet += line + "\n"
    ##print("modified_code_snippet\n", modified_code_snippet)
    return modified_code_snippet


def remove_empty_lines(code):
    lines = code.splitlines()
    non_empty_lines = [line for line in lines if line.strip() != ""]
    return "\n".join(non_empty_lines)


def remove_python_comments(code):
    # Split each line and take the part before the "#" symbol
    cleaned_lines = [line.split("#", 1)[0] for line in code.split("\n")]

    # Join the modified lines back to form the cleaned code
    cleaned_code = "\n".join(cleaned_lines)
    return cleaned_code


def remove_java_comments(code):
    # Remove single-line comments (//)
    cleaned_lines = [line.split("//", 1)[0] for line in code.split("\n")]
    cleaned_code = "\n".join(cleaned_lines)
    return cleaned_code.strip()


def unittest_evaluation(
    language,
    fixed_code,
    starting_code,
    default_test_code,
    unittest_case,
    data_files=None,
):
    if language == "java":
        return java_unittest_evaluation(
            fixed_code, starting_code, default_test_code, unittest_case, data_files
        )
    else:
        return python_unittest_evaluation(
            fixed_code, starting_code, default_test_code, unittest_case, data_files
        )


def java_unittest_evaluation(
    fixed_code, starting_code, default_test_code, unittest_case, data_files=None
):
    try:
        fixed_code.split("\n")
        fixed_code = extract_code_line(fixed_code)
        fixed_code = remove_empty_lines(fixed_code)
        fixed_code = remove_java_comments(fixed_code)
    except Exception:
        return False, fixed_code

    try:
        print("fixed_code_test", fixed_code)
        java_test_result = load_and_run_java_tests(
            fixed_code, unittest_case, data_files
        )
        print("java_results\n", java_test_result)
        return java_test_result, fixed_code
    except Exception:
        return False, fixed_code


def python_unittest_evaluation(
    fixed_code, starting_code, default_test_code, unittest_case, data_files=None
):
    """
    Load and run Python test cases against the provided code.
    Inputs:
        fixed_code (str): The Python code to be tested.
        starting_code (str): The default starting code provided to the student. Now it's ""
        default_test_code (str): The default test code provided to the student. Now it's "".
        unittest_case (str): The Python test cases. The test code is automatically reformatted based on the unittest_code provided by instructors in the RST file.
        data_files (list): The question's data files the code may open (see jobe.push_data_files).
    Output:
        bool: True if all tests pass, False otherwise.
        str: The cleaned fixed code after removing comments and empty lines.
    """
    try:
        fixed_code.split("\n")
        fixed_code = extract_code_line(fixed_code)
        fixed_code = remove_default_testline(fixed_code, default_test_code)
        fixed_code = remove_empty_lines(fixed_code)
        fixed_code = remove_python_comments(fixed_code)
        # print("cleaned_fixed_code\n", fixed_code)
    except Exception:
        return False, fixed_code
    try:
        ##print("fixed_code_first attempt", fixed_code)
        results = load_and_run_tests(unittest_case, fixed_code, data_files=data_files)
        print("results.wasSuccessful()\n", results.wasSuccessful())
        return results.wasSuccessful(), fixed_code
    except Exception:
        try:
            fixed_code = fix_indentation(fixed_code)
            results = load_and_run_tests(
                unittest_case, fixed_code, data_files=data_files
            )
            # print("fix_indentation", fixed_code)
            if contain_default_starting_code(starting_code, fixed_code):
                # print("results.wasSuccessful()\n", results.wasSuccessful())
                return results.wasSuccessful(), fixed_code
            else:
                return False, fixed_code
        except Exception:
            return False, fixed_code


def code_distractor_unittest_evaluation(
    language,
    code_with_distrator,
    starting_code,
    default_test_code,
    unittest_case,
    data_files=None,
):
    """
    Evaluate the code with distractors using unit tests.
    Inputs:
        language (str): The programming language of the code ('python' or 'java').
        code_with_distrator (str): The code with distractors to be evaluated.
        starting_code (str): The default starting code provided to the student. Now it's ""
        default_test_code (str): The default test code provided to the student. Now it's "".
        unittest_case (str): The Python/Java test cases. The test code is automatically reformatted based on the unittest_code provided by instructors in the RST file.
        data_files (list): The question's data files the code may open (see jobe.push_data_files).
    Output:
        bool: True if all tests pass, False otherwise.
        str: The cleaned code with distractors after removing comments and empty lines.
    """
    if language == "java":
        try:
            java_test_result = load_and_run_java_tests(
                code_with_distrator, unittest_case, data_files
            )
            return java_test_result, code_with_distrator
        except Exception:
            return False, code_with_distrator
    else:
        try:
            results = load_and_run_tests(
                unittest_case, code_with_distrator, data_files=data_files
            )
            if contain_default_starting_code(starting_code, code_with_distrator):
                return results.wasSuccessful(), code_with_distrator
            else:
                return False, code_with_distrator
        except Exception:
            try:
                code_with_distrator = fix_indentation(code_with_distrator)
                results = load_and_run_tests(
                    unittest_case, code_with_distrator, data_files=data_files
                )
                if contain_default_starting_code(starting_code, code_with_distrator):
                    return results.wasSuccessful(), code_with_distrator
                else:
                    return False, code_with_distrator
            except Exception:
                return False, code_with_distrator


def clean_student_code(student_code, default_test_code):
    """
    Clean the student's code by removing default test lines, empty lines, and comments.
    Inputs:
        student_code (str): The student's code to be cleaned.
        default_test_code (str): The default test code provided to the student. Now it's "".
    Output:
        str: The cleaned student code.
    """
    try:
        student_code.split("\n")
        cleaned_student_code = remove_default_testline(student_code, default_test_code)
        cleaned_student_code = remove_empty_lines(cleaned_student_code)
        cleaned_student_code = remove_python_comments(cleaned_student_code)
    except Exception:
        cleaned_student_code = student_code

    return cleaned_student_code
