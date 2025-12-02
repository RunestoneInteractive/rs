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
from fastapi import APIRouter, Request
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
from rsptx.db.crud.crud import fetch_api_token
from rsptx.db.crud.course import fetch_course

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
async def parsons_scaffolding(request: Request, course: Optional[str]):
    # Get `course` directly from the query string
    rslogger.warning(f"URL seen: {request.url}")
    rslogger.warning(f"Query parameters: {request.query_params}")
    course_name = request.query_params.get("course")
    # Import api key and handles errors
    api_token = None
    rslogger.warning(f"CodeTailor: Received request for course '{course_name}'")
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
    req = req_bytes.decode("utf-8")
    data = await request.json()

    language = data.get("language")  # Capture the question language from the front end
    student_code = data.get(
        "student_code"
    )  # Capture the student code from the front end
    problem_id = data.get("problem_id")  # Capture the problem name from the front end
    personalization_level = data.get(
        "personalization_level"
    )  # Capture the personalization level set by the instructor from the front end
    parsonsexample = data.get(
        "parsonsexample"
    )  # Capture whether the scaffolding puzzle is a pre-defined example or LLM-example
    problem_description = data.get(
        "problem_description"
    )  # Capture the problem description from the front end
    internal_test_case = data.get(
        "internal_test_case"
    )  # Capture the internal test case from the front end
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
