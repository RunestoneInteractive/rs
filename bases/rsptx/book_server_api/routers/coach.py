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
from typing import Optional
import re
from fastapi import status

from .assessment import get_question_source, SelectQRequest

# Import function for fetching api - comment out for DEV purposes
from rsptx.auth.session import auth_manager
from rsptx.db.crud.crud import fetch_api_token
from rsptx.db.crud.course import fetch_course
from rsptx.db.crud.question import fetch_question

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
DEV_API_KEY = ""
# for dev/test -- replace with your own key for local testing


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
    result = re.sub(r"^\s*myTests\(\)\.main\(\)\s*$", "", result, flags=re.MULTILINE)
    return result


def extract_parsons_code(html_block):
    """
    Given the full HTML/pre block for a Parsons problem extracted from DB,
    return only the Parsons code part.
    """
    # Remove all HTML tags and extract the code lines
    text = re.sub(r"<.*?>", "", html_block, flags=re.DOTALL)
    lines = text.strip().splitlines()
    if "-----" in lines:
        idx = lines.index("-----")
        code_lines = lines[idx + 1 :]
    else:
        code_lines = lines

    clean_lines = [
        line for line in code_lines if line.strip() and line.strip() != "====="
    ]
    return "\n".join(clean_lines)


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
        parsonsexample_code
        + "||split||"
        + parsons_html
        + "||split||"
        + personalization_level
        + "||split||"
        + "example_solution"
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

    html = None
    if isinstance(result, dict):
        html = result.get("detail")
    else:
        html = getattr(result, "detail", None)

    # Handle missing or error cases
    if not html or "No Questions" in html or "not in the database" in html:
        return {"html": "LLM-example"}

    return {"html": html}


# @router.post("/ns/coach/parsons_scaffolding")
@router.post("/parsons_scaffolding")
async def parsons_scaffolding(
    request: Request, course: Optional[str], user=Depends(auth_manager)
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
    parsons_personalized = data.get("parsons_personalized", True)

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

    # Fetch API token
    api_token = None
    try:
        if (
            course_name is None or course_name == "personalized_parsons"
        ):  # the test course for development
            # Dev/Test mode testing
            rslogger.warning("CodeTailor: Using predefined dev API key")
            api_token = DEV_API_KEY
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
            # this does not return a token, it returns an APITokenValidator object

            token_record = await fetch_api_token(  # handles decryption already
                course_id=course.id,
                provider="openai",  # from add_token.html <option value="openai">
                # hardcoded as openai for now, prompt structures are different for different providers
                # if we find instructors tend to use other platforms, we need to handle this later
            )
            if token_record is None:
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
            api_token = token_record.token
            rslogger.warning(
                f"CodeTailor: Fetching course: {course_name}, id: {course.id}, provider: openai, api_token: {api_token[:4]}****"
            )
    except Exception as e:
        rslogger.error(f"CodeTailor: Error fetching API tokens: {e}")
        return JSONResponse(
            content={"error": f"Error fetching API tokens: {str(e)}"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if api_token is None:
        return JSONResponse(
            content={"error": "CodeTailor: No openai API found"},
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
    parsons_personalized = data.get("parsons_personalized", True)

    if not problem_id:
        return JSONResponse(
            content={"error": "CodeTailor: problem_id is required"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Fetch the test code from the database using the problem_id.
    try:
        basecourse = getattr(course, "base_course", None)
        question = await fetch_question(problem_id, basecourse=basecourse)
        if question and question.question_json:
            internal_test_case = question.question_json.get("suffix_code", "") or ""
        else:
            rslogger.error(
                f"CodeTailor: no question found for problem_id '{problem_id}'"
            )
            return JSONResponse(
                content={"error": f"CodeTailor: question '{problem_id}' not found"},
                status_code=status.HTTP_400_BAD_REQUEST,
            )
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

    if language and language.lower() == "python":
        internal_test_case = clean_python_testcase(internal_test_case)

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
            "Example": parsonsexample_code,  # This is the html of the example Parsons problem
            "CF (Code)": student_code,
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

            example_code = get_example_solution(
                api_token, language, problem_description, internal_test_case
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
            example_block = re.sub(r"<(?=\S)", "< ", example_block)
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
        ) = parsons_help(
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
            personalized_Parsons_block = re.sub(
                r"<(?=\S)", "< ", personalized_Parsons_block
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
