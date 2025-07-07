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
import pandas as pd
import re
import os

# Third-party imports
# -------------------
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from pyflakes import checker as pyflakes_checker

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from .personalized_parsons.end_to_end import get_parsons_help

# Import function for fetching api
from components.rsptx.db.crud import fetch_api_token
# other imports
from components.rsptx.logging import rslogger
from components.rsptx.response_helpers.core import make_json_response

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


# Starting here -- Added code for personalized Parsons scaffolding ---

@router.post("/parsons_scaffolding")
@with_course() # Students need to be logged in to a course
async def parsons_scaffolding(
    request: Request,
    course: None, # The decorator will get the course
):
    # Import api key and handles errors
    api_token = None
    try:
        api_token = await fetch_api_token( # handles decryption already
            course_id=course.id,
            provider='openai', # Zihan's note (06/30/25): current provider options: "openai", "anthropic", "google", "azure",
                               # or other user specified value; we should change this from hard coding to handling different
                               # models if we find that other models also work.
                               # Xinying's note (07/05/2025): prompt structures are different for different providers -- need to handle this
        )
    except Exception as e:
        rslogger.error(f"Codetailor: Error fetching API tokens: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error fetching API tokens: {str(e)}",
        )
    if api_token == None:
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"CodeTailor: No openai API found",
        )

    """
    Takes in student code, generate a personalized Parsons problems with openAI,
    then converts the generated problem to .rst, and returns the .rst string.
    """
    # Provides a built-in CSV file as the data source for the personalized puzzle question bank. 
    # TODO: Refactor to dynamically source puzzles via Parsons Puzzle and ActiveCode authoring interfaces.
    # Get the directory of the current script
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Adjust path to navigate directly to personalized_parsons from routers
    csv_dir = os.path.join(script_dir, "personalized_parsons")

    # Build the full path to the CSV file
    csv_path = os.path.join(csv_dir, "Material_Bank.csv")

    df_question_bank = pd.read_csv(csv_path).fillna('')

    req_bytes = await request.body()
    req = req_bytes.decode("utf-8")
    print("req", req)
    language = req.split("|||sep|||")[0] # Capture the language from the front end
    student_code = req.split("|||sep|||")[1] # Capture the student code from the front end
    problem_name = req.split("|||sep|||")[2] # Capture the problem name from the front end
    instructor_personalized_level = req.split("|||sep|||")[3] # Capture the instructor personalized level from the front end
    adaptive_or_not = req.split("|||sep|||")[4] # Capture whether the puzzle is adaptive or not from the front end
    no_indent_or_not = req.split("|||sep|||")[5] # Capture whether the puzzle has no indent or not from the front end
    puzzle_execution_grader = req.split("|||sep|||")[6] # Capture whether the puzzle has execution grader or not from the front end
    print("start_to: get_parsons_help", api_token, language, instructor_personalized_level, adaptive_or_not, no_indent_or_not)

    adaptive_attr = 'data-adaptive="true"' if adaptive_or_not != 'undefined' else ''
    no_indent_attr = 'data-noindent="true"' if no_indent_or_not != 'undefined' else ''
    grader_attr = f'data-grader="execution"' if puzzle_execution_grader != 'undefined' else ''
    language_attr = f'data-language="{language}"'
    # used in the parsons.js to determine whether the Parsons puzzle is created as scaffolding puzzle or not
    scaffolding_attr = f'data-scaffolding="true"'
    parsons_attrs = f"{language_attr} {adaptive_attr} {grader_attr} {no_indent_attr} {scaffolding_attr}".strip()
    df_question_line = df_question_bank[df_question_bank["Problem Name"] == problem_name].reset_index(drop=True)
    test_case = df_question_line["Unittest_Code"][0].replace("\\n", "\n")

    def parsons_help(language, student_code, problem_name, personalize_level):
        input_dict = {
            "Problem Name":problem_name,
            "CF (Code)":student_code
        }
        return get_parsons_help(api_token, language, input_dict, df_question_bank, personalize_level)

    if instructor_personalized_level == "Solution":
        personalized_code_solution, full_personalized_Parsons_block, personalized_solution_generation_type, personalized_generation_result_type = parsons_help(language, student_code, problem_name, instructor_personalized_level)
        if puzzle_execution_grader != 'undefined':
            full_personalized_Parsons_block = full_personalized_Parsons_block + "\n" + "/* execute test */" + "\n" + test_case
        full_personalized_Parsons_block = re.sub(r'<(?=\S)', '< ', full_personalized_Parsons_block)
        solution_personalized_parsons_html = f"""
        <pre class="parsonsblocks" data-question_label="1" data-numbered="left" {parsons_attrs} style="visibility: hidden;">
        {full_personalized_Parsons_block}
        </pre>
        """
        return personalized_code_solution + "||split||" + solution_personalized_parsons_html  + "||split||" + personalized_solution_generation_type + "||split||" + personalized_generation_result_type
    elif instructor_personalized_level == "Multiple":
        personalized_code_solution, multi_personalized_Parsons_block, personalized_solution_generation_type, personalized_generation_result_type = parsons_help(language, student_code, problem_name, instructor_personalized_level)
        if puzzle_execution_grader != 'undefined':
            multi_personalized_Parsons_block = multi_personalized_Parsons_block + "\n" + "/* execution test */" + "\n" + test_case
        multi_personalized_Parsons_block = re.sub(r'<(?=\S)', '< ', multi_personalized_Parsons_block)
        multi_personalized_parsons_html = f"""
        <pre class="parsonsblocks" data-question_label="1" data-numbered="left" {parsons_attrs} style="visibility: hidden;">
        {multi_personalized_Parsons_block}
        </pre>
        """
        return personalized_code_solution + "||split||" + multi_personalized_parsons_html + "||split||" + personalized_solution_generation_type + "||split||" + personalized_generation_result_type
    elif instructor_personalized_level == "Common":
        common_solution, common_Parsons_block, common_solution_generation_type, common_generation_result_type = parsons_help(language, student_code, problem_name, instructor_personalized_level)
        if puzzle_execution_grader != 'undefined':
            common_Parsons_block = common_Parsons_block + "\n" + "/* execution test */" + "\n" + test_case
        common_Parsons_block = re.sub(r'<(?=\S)', '< ', common_Parsons_block)
        common_parsons_html = f"""
        <pre class="parsonsblocks" data-question_label="1" data-numbered="left" {parsons_attrs} style="visibility: hidden;">
        {common_Parsons_block}
        </pre>
        """
        return common_solution + "||split||" + common_parsons_html + "||split||" + common_solution_generation_type + "||split||" + common_generation_result_type
    else:
        # Handle the case where personalize_level is not recognized
        return JSONResponse(content={"error": "Invalid personalize_level"}, status_code=400)
