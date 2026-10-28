# ***********************************
# |docname| - Provide code advice
# ***********************************
# Endpoints to provide various kinds of advice (syntax/style/etc...)
# about code samples
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import ast
import asyncio
import html
import json

# Third-party imports
# -------------------
from fastapi import APIRouter, Depends, Request
from pyflakes import checker as pyflakes_checker

# Local application imports
# -------------------------
from rsptx.logging import rslogger

# CodeTailor related imports
# -------------------------
from fastapi.responses import JSONResponse
from .personalized_parsons.end_to_end import get_parsons_help
from .personalized_parsons.buggy_code_checker import (
    clean_java_code,
    clean_python_code,
)
from .personalized_parsons.subgoal_labels import (
    build_label_puzzle,
    is_label_line,
    label_texts,
)
from typing import Optional
import re
from fastapi import status

from .assessment import get_question_source, SelectQRequest

# Import function for fetching api - comment out for DEV purposes
from rsptx.auth.session import get_optional_user
from rsptx.db.crud.course import fetch_course

from ..activecode_questions import (
    clean_python_testcase,
    data_file_candidates,
    fetch_data_files,
    find_question,
    question_test_code,
    starter_code_from_question,
)
from ..openai_token import dev_llm_token, fetch_llm_token, uses_dev_api_key

# .. _APIRouter config:
#
# Routing
# =======
# Setup the router object for the endpoints defined in this file.  These will
# be `connected <included routing>` to the main application in `../main.py`.
router = APIRouter(
    # shortcut so we don't have to repeat this part
    prefix="/coach",
    tags=["coach"],
)

# Questions whose label ends with this suffix always get the instructor's
# backup Parsons problem, never a personalized one, whatever their
# data-parsons-personalized says. PreTeXt's @codetailor can only ask for
# personalization, so this lets a PreTeXt book pair a personalized and a
# non-personalized copy of an exercise in an A/B <select>. Added for a
# CodeTailor study in Fall 2026; it can be removed once that study ends.
STATIC_ARM_SUFFIX = "-ct-static"


def _is_static_arm(problem_id):
    return bool(problem_id) and problem_id.endswith(STATIC_ARM_SUFFIX)


@router.post("/python_check")
async def python_check(request: Request):
    """
    Takes a chunk of Python code and runs a syntax checker (currently
    Pyflakes) on it to provide more detailed advice than is available
    via Skulpt.
    """
    try:
        code_bytes = await request.body()
    except Exception as e:
        rslogger.error(f"Error reading request body: {e}")
        return ""
    try:
        code = code_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return "Invalid UTF-8 encoding"

    filename = "program.py"

    resultMessage = ""
    try:
        tree = ast.parse(code, filename=filename)
        w = pyflakes_checker.Checker(tree, filename=filename)
        w.messages.sort(key=lambda m: m.lineno)
        for m in w.messages:
            resultMessage = resultMessage + str(m) + "\n"
    except SyntaxError as e:
        resultMessage = f"{filename}:{str(e.lineno)}:{str(e.offset)}: {e.args[0]}\n"

    return resultMessage


# Starting here -- Added code for CodeTailor ---
def extract_parsons_code(html_block):
    """
    Given the full HTML for a Parsons question fetched from the DB, return only
    the code inside <pre class="parsonsblocks">...</pre> -- the question prompt
    text lives in a sibling <div class="parsons_question"> and must be excluded,
    otherwise it gets treated as (and rendered as) one of the draggable blocks.

    This is the raw Parsons editor markup ("---"-separated blocks, some tagged
    "#distractor"/"#paired"/"#settled"/"#tag:...;...;"), still needed as-is by
    the Parsons puzzle widget (parsons.js parses this same markup client-side).
    Use extract_parsons_solution() to get compilable solution code instead.
    """
    pre_match = re.search(
        r'<pre[^>]*class="parsonsblocks"[^>]*>(.*?)</pre>', html_block, flags=re.DOTALL
    )
    pre_content = pre_match.group(1) if pre_match else html_block

    # Remove HTML tags -- only a "<" followed by a letter or "/" and closed on
    # the same line. Some stored markup keeps a bare "<" in its code
    # ("if close < low_close:"), and a looser pattern ran from that "<" to the
    # next ">" (often in the paired distractor), deleting the code and the
    # "---" between them so a correct block merged into its distractor.
    text = re.sub(r"</?[A-Za-z][^<>\n]*>", "", pre_content)
    # Escape any "<" left, so the result is escaped markup like the rest of
    # the stored questions ("&lt;"), which the Parsons widget expects
    text = text.replace("<", "&lt;")
    lines = text.strip().splitlines()
    if "-----" in lines:
        idx = lines.index("-----")
        code_lines = lines[idx + 1 :]
    else:
        code_lines = lines

    clean_lines = [
        line for line in code_lines if line.strip() and line.strip() != "====="
    ]
    result = "\n".join(clean_lines)
    return result


def extract_parsons_solution(parsonsexample_code):
    """
    Given the raw Parsons editor markup (as returned by extract_parsons_code),
    return only the compilable solution code: "---"-separated blocks tagged
    "#distractor"/"#paired" are dropped entirely (they aren't part of the
    correct solution), and scaffolding tags ("#settled", "#tag:...;...;") are
    stripped from the remaining blocks. Mirrors the block-parsing logic in
    runestone/parsons/js/parsons.js::initializeLines.

    extract_parsons_code() deliberately leaves HTML entities (e.g. "&lt;")
    escaped, since its result is also re-embedded into a <pre> block for the
    Parsons widget to re-render. This function's result instead goes straight
    into a plain-text answer (clipboard copy, code_answer), so it must be
    unescaped here or a "<" in the source shows up as literal "&lt;".
    """
    blocks = parsonsexample_code.split("---")
    clean_lines = []
    for block in blocks:
        if "#distractor" in block or "#paired" in block:
            # Not part of the correct solution -- drop the whole block.
            continue
        for line in block.splitlines():
            line = re.sub(r"#settled\b.*$", "", line)
            line = re.sub(r"#tag:[^;]*;[^;]*;\s*$", "", line)
            line = line.rstrip()
            if line.strip() and line.strip() != "=====":
                clean_lines.append(html.unescape(line))
    return "\n".join(clean_lines)


def _escape_parsons_block_markup(block_markup):
    """
    The generated "---"-separated block markup is about to be embedded into a
    <pre class="parsonsblocks"> element and re-parsed from innerHTML by
    parsons.js, so a bare "<" in the code (e.g. "if hours <= 1:") would be
    misread as the start of an HTML tag. HTML-escape it -- the Parsons widget
    renders entities back to their literal characters, the same way it already
    handles the escaped DB-authored markup (see extract_parsons_code).

    "<" is the only character that actually breaks parsing here -- ">" is plain
    data in element content and "&" only matters before a valid entity name --
    but html.escape covers "&"/">" too, which round-trip harmlessly through the
    widget. A previous version instead inserted a space after "<", which turned
    every "<="/"<" in the code into "< ="/"< ". The generated code never
    contains pre-existing entities, so escaping is safe to apply unconditionally.
    """
    return html.escape(block_markup, quote=False)


def _build_static_parsons_response(
    parsonsexample_code, parsons_attrs, personalization_level
):
    """Return the ||split|| response string for a pre-defined (non-LLM) backup Parsons problem."""
    parsons_html = f"""
            <pre class="parsonsblocks" data-question_label="1" data-numbered="left" {parsons_attrs} style="visibility: hidden;">
{parsonsexample_code}
            </pre>
            """
    return (
        extract_parsons_solution(parsonsexample_code)
        + "||split||"
        + parsons_html
        + "||split||"
        + personalization_level
        + "||split||"
        + "example_solution"
    )


async def _fetch_starter_code(problem_id, course_name):
    """
    Starter code for ``problem_id``, or "" if the question can't be found.
    Question names are unique only within a base course, so look in the
    course's base course first, then fall back to a global name match (a
    cloned course or a question pulled in from another book) -- the same
    order the main CodeTailor path uses.
    """
    if not problem_id:
        return ""
    try:
        course = None
        if course_name:
            try:
                course = await fetch_course(course_name)
            except AttributeError:
                course = None
        question = await find_question(problem_id, getattr(course, "base_course", None))
    except Exception as e:
        rslogger.error(
            f"CodeTailor: could not fetch starter code for '{problem_id}': {e}"
        )
        return ""
    return starter_code_from_question(question) if question else ""


def _adds_no_code(student_code, starter_code, language):
    """
    True when the student has written no code of their own: nothing beyond
    def/import lines, comments and blank lines, or exactly the starter code's
    statements (e.g. the untouched ``print(average([...]))`` call it ships with).
    """
    clean = clean_java_code if language == "java" else clean_python_code
    student = clean(student_code)
    return not student or student == clean(starter_code)


def _drop_starter_comments(student_code, starter_code, language):
    """Remove full-line comments the student's code shares with the starter."""
    starter_comments = label_texts(starter_code, language)
    return "\n".join(
        line
        for line in student_code.splitlines()
        if not (
            is_label_line(line, language) and " ".join(line.split()) in starter_comments
        )
    )


def _function_header(starter_code, language):
    """
    The starter code's header lines for the labels-only puzzle: the first
    ``def`` and any ``class`` lines above it. Python only -- a Java header
    would also need its closing braces -- and None when there is no ``def``.
    """
    if language == "java":
        return None
    header = []
    for line in starter_code.splitlines():
        if re.match(r"\s*class\s", line):
            header.append(line.rstrip())
        elif re.match(r"\s*(?:async\s+)?def\s", line):
            header.append(line.rstrip())
            return header
    return None


def _build_label_parsons_response(label_puzzle, parsons_attrs, personalization_level):
    """Return the ||split|| response string for a labels-only Parsons problem
    built from the backup problem's subgoal labels (see build_label_puzzle)."""
    solution, label_markup = label_puzzle
    parsons_html = f"""
            <pre class="parsonsblocks" data-question_label="1" data-numbered="left" {parsons_attrs} style="visibility: hidden;">
{label_markup}
            </pre>
            """
    return (
        solution
        + "||split||"
        + parsons_html
        + "||split||"
        + personalization_level
        + "||split||"
        + "subgoal_labels"
    )


@router.get("/get_question_html")
async def get_question_html(request: Request, div_id: str):
    """
    Fetch and return just the HTML for a single question (case 1).
    No grading — points are set to 0.
    Falls back to 'LLM-example' if the question is not found.
    """
    request_data = SelectQRequest(
        selector_id=div_id,
        questions=div_id,
        points=0,
        proficiency=None,
        min_difficulty=None,
        max_difficulty=None,
        not_seen_ever=False,
        autogradable=None,
        primary=None,
        AB=None,
        toggleOptions=None,
        timedWrapper=None,
        limitBaseCourse=None,
    )

    result = await get_question_source(request, request_data)

    # get_question_source returns a JSONResponse whose (JSON-encoded) body is
    # ``{"detail": <html>}``.  Decode the body to recover the html string.
    html = None
    if isinstance(result, dict):
        html = result.get("detail")
    else:
        body = getattr(result, "body", None)
        if body is not None:
            try:
                html = json.loads(body).get("detail")
            except (ValueError, AttributeError):
                html = None

    # Handle missing or error cases
    if not html or "No Questions" in html or "not in the database" in html:
        return {"html": "LLM-example"}

    return {"html": html}


# @router.post("/ns/coach/parsons_scaffolding")
@router.post("/parsons_scaffolding")
async def parsons_scaffolding(
    request: Request, course: Optional[str], user=Depends(get_optional_user)
):
    # Get `course` directly from the query string
    rslogger.warning(f"URL seen: {request.url}")
    rslogger.warning(f"Query parameters: {request.query_params}")
    course_name = request.query_params.get("course")
    rslogger.warning(f"CodeTailor: Received request for course '{course_name}'")

    # Parse body early so the fallback logic can access it before the API key check
    data = await request.json()
    language = data.get("language")
    student_code = data.get("student_code")
    problem_id = data.get("problem_id")
    personalization_level = data.get("personalization_level")
    parsonsexample = data.get("parsonsexample")
    problem_description = data.get("problem_description")
    internal_test_case = data.get("internal_test_case")
    parsons_personalized = data.get(
        "parsons_personalized", True
    ) and not _is_static_arm(problem_id)

    adaptive_attr = 'data-adaptive="true"'
    no_indent_attr = 'data-noindent="false"'
    language_attr = f'data-language="{language}"'
    # this scaffolding_attr is used in the parsons.js to determine whether the Parsons puzzle is created as automatic scaffolding puzzle or not
    scaffolding_attr = 'data-scaffolding="true"'
    parsons_attrs = (
        f"{language_attr} {adaptive_attr} {no_indent_attr} {scaffolding_attr}".strip()
    )

    # extract the HTML of the example Parsons problem, otherwise it is "LLM-example"
    parsonsexample_html = None
    if parsonsexample != "LLM-example":
        result = await get_question_html(request, div_id=parsonsexample)
        parsonsexample_html = result["html"]
        # Unable to test locally as it requires DB access
        parsonsexample_code = extract_parsons_code(parsonsexample_html)
    else:
        parsonsexample_code = "LLM-example"

    # A student who asks for help before writing any code has nothing for
    # CodeTailor to personalize. When the instructor wrote subgoal labels as
    # comments in the backup problem, give them a puzzle of just those labels,
    # under the function header from the starter code (locked in place for
    # the settled-block "Multiple" personalization). Untouched starter code
    # counts as no code. Checked before the login and API-token branches,
    # since it needs neither.
    if parsons_personalized and parsonsexample_html:
        label_language = "java" if (language or "").lower() == "java" else "python"
        starter_code = await _fetch_starter_code(problem_id, course_name)
        if _adds_no_code(student_code or "", starter_code, label_language):
            label_puzzle = build_label_puzzle(
                parsonsexample_code,
                label_language,
                header=_function_header(starter_code, label_language),
                # settled-block CodeTailor puzzles lock the header in place
                settle_header=personalization_level == "Multiple",
            )
            if label_puzzle:
                return _build_label_parsons_response(
                    label_puzzle, parsons_attrs, personalization_level
                )

    if user is None:
        # Browsing-mode/anonymous visitors can get the pre-authored backup
        # Parsons problem, but never the CodeTailor/LLM-personalized one --
        # that requires an account so we can call out to the LLM on their
        # behalf and track usage.
        if parsonsexample != "LLM-example" and parsonsexample_html:
            return _build_static_parsons_response(
                parsonsexample_code, parsons_attrs, personalization_level
            )
        return JSONResponse(
            content={
                "detail": "You need to be logged in to Runestone to access this resource"
            },
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    # Fetch API token
    api_token = None
    try:
        if uses_dev_api_key(course_name):
            # Dev/Test mode testing
            rslogger.warning("CodeTailor: Using predefined dev API key")
            api_token = dev_llm_token()
        else:
            # obtain the CoursesValidator object - Brad's review
            try:
                course = await fetch_course(course_name)
            except AttributeError:
                rslogger.error(f"CodeTailor: Course '{course_name}' not found.")
                return JSONResponse(
                    content={"error": "CodeTailor: No course found"},
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            rslogger.warning(
                f"[CodeTailor] Fetching course: {course_name}, id: {course.id}"
            )
            api_token = await fetch_llm_token(course)
            if api_token is None:
                rslogger.error(
                    f"CodeTailor: No API token found for course '{course_name}'."
                )
                if parsonsexample != "LLM-example" and parsonsexample_html:
                    rslogger.warning(
                        f"CodeTailor: No API token for '{course_name}' — serving static backup Parsons."
                    )
                    return _build_static_parsons_response(
                        parsonsexample_code, parsons_attrs, personalization_level
                    )
                return JSONResponse(
                    content={"error": "CodeTailor: No API token found for this course"},
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            rslogger.warning(
                f"CodeTailor: Fetching course: {course_name}, id: {course.id}, provider: {api_token.provider}, api_token: {api_token.masked()}"
            )
    except Exception as e:
        rslogger.error(f"CodeTailor: Error fetching API tokens: {e}")
        return JSONResponse(
            content={"error": f"Error fetching API tokens: {str(e)}"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if api_token is None:
        return JSONResponse(
            content={"error": "CodeTailor: No LLM API token found"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    rslogger.warning("CodeTailor: api_token obtained successfully")
    # Start to process the request from activecode.js
    req_bytes = await request.body()
    _ = req_bytes.decode("utf-8")
    data = await request.json()

    language = data.get("language")
    student_code = data.get("student_code")
    problem_id = data.get("problem_id")
    personalization_level = data.get("personalization_level")
    parsonsexample = data.get("parsonsexample")
    problem_description = data.get("problem_description")
    parsons_personalized = data.get(
        "parsons_personalized", True
    ) and not _is_static_arm(problem_id)

    if not problem_id:
        return JSONResponse(
            content={"error": "CodeTailor: problem_id is required"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Fetch the test code from the database using the problem_id.
    try:
        basecourse = getattr(course, "base_course", None)
        question = await find_question(problem_id, basecourse)
        if not question:
            rslogger.error(
                f"CodeTailor: no question found for problem_id '{problem_id}'"
            )
            return JSONResponse(
                content={"error": f"CodeTailor: question '{problem_id}' not found"},
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        internal_test_case = question_test_code(question)
    except Exception as e:
        rslogger.error(f"CodeTailor: could not fetch test code for '{problem_id}': {e}")
        return JSONResponse(
            content={
                "error": f"CodeTailor: could not fetch test code for '{problem_id}'"
            },
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if not internal_test_case:
        rslogger.error(
            f"CodeTailor: question '{problem_id}' has no suffix_code in question_json — cannot validate generated code"
        )
        return JSONResponse(
            content={
                "error": f"CodeTailor: question '{problem_id}' has no test code in the database"
            },
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Questions say "python3" as often as "python"
    if language and language.lower().startswith("python"):
        internal_test_case = clean_python_testcase(internal_test_case)

    # Files the program opens (datafiles) must travel with each JOBE test run,
    # or every generated solution fails with a missing-file error.
    data_files = await fetch_data_files(
        data_file_candidates(question.htmlsrc, internal_test_case, student_code),
        list(
            dict.fromkeys(
                [
                    (basecourse, course_name),
                    (question.base_course, question.base_course),
                ]
            )
        ),
    )
    if data_files:
        rslogger.info(
            f"CodeTailor: '{problem_id}' uses data files "
            f"{[data_file['filename'] for data_file in data_files]}"
        )

    # Comments that ship with the starter code ("# write code here") are not
    # the student's subgoal labels, so CodeTailor should not keep them.
    student_code = _drop_starter_comments(
        student_code or "",
        starter_code_from_question(question),
        "java" if (language or "").lower() == "java" else "python",
    )

    print("start_to: get_parsons_help", api_token, language, personalization_level)

    adaptive_attr = 'data-adaptive="true"'
    no_indent_attr = 'data-noindent="false"'
    language_attr = f'data-language="{language}"'
    # this scaffolding_attr is used in the parsons.js to determine whether the Parsons puzzle is created as automatic scaffolding puzzle or not
    scaffolding_attr = 'data-scaffolding="true"'
    parsons_attrs = (
        f"{language_attr} {adaptive_attr} {no_indent_attr} {scaffolding_attr}".strip()
    )

    # extract the HTML of the example Parsons problem, otherwise it is "LLM-example"
    parsonsexample_html = None
    if parsonsexample != "LLM-example":
        result = await get_question_html(request, div_id=parsonsexample)
        parsonsexample_html = result["html"]
        # Unable to test locally as it requires DB access
        parsonsexample_code = extract_parsons_code(parsonsexample_html)
    else:
        parsonsexample_code = "LLM-example"

    def parsons_help(
        language,
        student_code,
        problem_id,
        problem_description,
        internal_test_case,
        parsonsexample_code,
        personalization_level,
    ):
        """
        Call the get_parsons_help function to get the personalized Parsons puzzle and the solution code.
        """
        input_dict = {
            "Problem Name": problem_id,
            "Problem Description": problem_description,
            "Unittest_Code": internal_test_case,
            "Example": (
                parsonsexample_code
                if parsonsexample_code == "LLM-example"
                else extract_parsons_solution(parsonsexample_code)
            ),  # compilable solution code, not raw Parsons block markup --
            # this can be returned verbatim as the fixed/example code when
            # LLM personalization falls back (see end_to_end.generate_example_solution)
            "CF (Code)": student_code,
            "Data_Files": data_files,
        }
        return get_parsons_help(api_token, language, input_dict, personalization_level)

    if not parsons_personalized:
        # Return example without CodeTailor personalization
        if parsonsexample != "LLM-example" and parsonsexample_html:
            return _build_static_parsons_response(
                parsonsexample_code, parsons_attrs, personalization_level
            )
        else:
            from .personalized_parsons.get_personalized_solution import (
                get_example_solution,
            )
            from .personalized_parsons.generate_parsons_blocks import (
                generate_Parsons_block,
            )

            # Calls out to an LLM; keep the blocking client off the event loop.
            example_code = await asyncio.to_thread(
                get_example_solution,
                api_token,
                language,
                problem_description,
                internal_test_case,
                data_files,
            )
            if not example_code:
                return (
                    "emptyHelpCode"
                    + "||split||emptyHelpParsons"
                    + "||split||"
                    + personalization_level
                    + "||split||example_solution"
                )
            example_block = generate_Parsons_block(
                "Solution",
                language,
                "Full",
                problem_description,
                example_code,
                [],
                [],
                {},
            )
            example_block = _escape_parsons_block_markup(example_block)
            parsons_html = f"""
            <pre class="parsonsblocks" data-question_label="1" data-numbered="left" {parsons_attrs} style="visibility: hidden;">
{example_block}
            </pre>
            """
            return (
                example_code
                + "||split||"
                + parsons_html
                + "||split||"
                + personalization_level
                + "||split||"
                + "example_solution"
            )

    if personalization_level in ["Solution", "Multiple"]:
        (
            personalized_code_solution,
            personalized_Parsons_block,
            personalized_solution_generation_type,
            personalized_generation_result_type,
        ) = await asyncio.to_thread(
            # parsons_help talks to an LLM and to jobe with blocking clients, so
            # it has to run in a thread or it stalls the whole event loop.
            parsons_help,
            language,
            student_code,
            problem_id,
            problem_description,
            internal_test_case,
            parsonsexample_code,
            personalization_level,
        )
        if personalized_code_solution == "":
            return (
                "emptyHelpCode"
                + "||split||"
                + "emptyHelpParsons"
                + "||split||"
                + personalization_level
                + "||split||"
                + personalized_generation_result_type
            )
        if personalized_Parsons_block == "Correct_Code":
            return (
                personalized_code_solution
                + "||split||"
                + "correctCode"
                + "||split||"
                + personalization_level
                + "||split||"
                + personalized_generation_result_type
            )
        else:
            personalized_Parsons_block = _escape_parsons_block_markup(
                personalized_Parsons_block
            )
            personalized_Parsons_html = f"""
            <pre class="parsonsblocks" data-question_label="1" data-numbered="left" {parsons_attrs} style="visibility: hidden;">
{personalized_Parsons_block}
            </pre>
            """
            print(
                "personalized_Parsons_html",
                personalized_Parsons_html,
                "personalization_level",
                personalization_level,
                "personalized_generation_result_type",
                personalized_generation_result_type,
            )
            return (
                personalized_code_solution
                + "||split||"
                + personalized_Parsons_html
                + "||split||"
                + personalization_level
                + "||split||"
                + personalized_generation_result_type
            )
    else:
        # Handle the case where personalization_level is not valid
        rslogger.error(f"Invalid personalization_level: {personalization_level}")
        return JSONResponse(
            content={"error": "Invalid personalization_level"}, status_code=400
        )
