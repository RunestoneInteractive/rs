from openai import OpenAI
import re

from .evaluate_fixed_code import *

# Below is the system message as part of the prompt to generate the fixed code
system_message = """
Fix the provided {programming_language} [user-code] based on the provided [task-description] and [sample-solution] and generate the [fixed-code]. 
The [fixed-code] should pass the provided [unittest-code] and be more similar to the [user-code] than the [sample-solution].
When possible, the [fixed-code] should follow the existing solving strategy and solution path in [user-code], use the same type of [control_structures], use the same variable names as [user-code]. 
The [fixed-code] should require the least amount of edits from the [user-code].
For example, the [user-code] uses [control_structures], the [fixed-code] should also use these [control_structures] when establishing the solution.
The [fixed-code] should follow the {programming_language} style guide.
[task-description]: '{question_description}'
[end-task-description]

[sample-solution]: '{example_solution}'
[end-solution]

[unittest-code]: '{unittest_code}'
[end-unittest-code]

[control-structures]: '{control_structures}'
[end-control-structures]
"""

def find_control_structures_java(buggy_code):
    """
    Find control structures in Java code.
    Include them in the prompt to encourage the LLM to use similar structures in the fixed code.
    """
    control_structures_java = []

    # regular expressions for some common control structures and loops in entry-level Java code
    regex_for = r'for\s*\(\s*.*?\s*\)\s*\{'
    regex_while = r'while\s*\(\s*.*?\s*\)\s*\{'
    regex_if_elif = r'if\s*\(.*?\)\s*\{|\belse if\b\s*\(.*?\)\s*\{'
    regex_if_else = r'if\s*\(.*?\)\s*\{|\belse\b\s*\{'

    # check for each regex pattern in the code snippet
    if re.search(regex_for, buggy_code):
        control_structures_java.append("for-loop")
    if re.search(regex_while, buggy_code):
        control_structures_java.append("while-loop")
    if re.search(regex_if_elif, buggy_code):
        control_structures_java.append("if-or-elif-condition")
    if re.search(regex_if_else, buggy_code):
        control_structures_java.append("if-or-else-condition")

    return control_structures_java

def find_control_structures_python(buggy_code):
    """
    Find control structures in Python code.
    Include them in the prompt to encourage the LLM to use similar structures in the fixed code
    """
    control_structures = []

    # regular expressions for some common control structures and loops in entry-level Python code
    regex_for = r'for\s+\w+\s+in\s+\w+\s*:'
    regex_while = r'while\s+\w+\s*:'
    regex_for_range = r'for\s+\w+\s+in\s+range\('
    regex_for_items = r'for\s+\w+\s*,\s*\w+\s+in\s+\w+\.items\(\)'
    regex_if_elif = r'if\s+\w+\s*:\s*|elif\s+\w+\s*:'
    regex_if_else = r'if\s+\w+\s*:\s*|else\s*:'

    # check for each regex pattern in the code snippet
    if re.search(regex_for, buggy_code): 
        control_structures.append("for-loop")
    if re.search(regex_while, buggy_code):
        control_structures.append("while-loop")
    if re.search(regex_for_range, buggy_code):
        control_structures.append("for-range-loop")
    if re.search(regex_for_items, buggy_code):
        control_structures.append("for-items-loop")
    if re.search(regex_if_elif, buggy_code):
        control_structures.append("if-or-elif-condition")
    if re.search(regex_if_else, buggy_code):
        control_structures.append("if-or-else-condition")

    return control_structures


def build_code_prompt(language, problem_description, buggy_code, unittest_code, example_solution, system_message, attempt_type):
    """
    Build the prompt messages for the LLM to generate the personalized fixed code. Here we use zero-shot prompting.
    This decision is made to reduce instructor burden to provide example buggy / personalized solutions.
    Inputs:
        language (str): The programming language of the code ("python" or "java").
        problem_description (str): The description of the coding problem.
        buggy_code (str): The student's buggy code.
        unittest_code (str): The unittest code to validate the fixed code.
        example_solution (str): The example solution code.
        system_message (str): The system message template for the prompt.
        attempt_type (str): The type of attempt ("new" or "repeat").
    Output:
        list: The list of prompt messages for the LLM.
    """
    if attempt_type in ["new", "repeat"]:
        if language == "java":
            control_structures = find_control_structures_java(buggy_code)
        else:
            control_structures = find_control_structures_python(buggy_code)

        system_message = system_message.format(
            programming_language = language,
            question_description = problem_description,
            example_solution = example_solution,
            unittest_code = unittest_code,
            control_structures = control_structures
        )

    prompt_code = "[user-code]:\n" + buggy_code + "\n[end-user-code]"
    prompt_messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt_code},
        ]

    return prompt_messages
        
def generate_personalized_fix(api_token, prompt_messages, attempt_type, situation, old_fixed_code):
    """
    Generate the personalized fixed code using the LLM.
    Inputs:
        api_token (str): The API token for the LLM.
        prompt_messages (list): The list of prompt messages for the LLM.
        attempt_type (str): The type of attempt ("new" or "repeat").
        situation (str): The situation of the attempt ("a correct answer"). This can be extended to other nuanced situations in the future.
        old_fixed_code (str): The old fixed code from the previous attempt (if any).
    Output:
        str: The generated personalized fixed code.
    """
    if attempt_type in ["new"]:
        prompt_messages = prompt_messages
    elif attempt_type == "repeat":
        attachment = f"""
        This [old-fixed-code] is not {situation} to the [user-code]. Again, please try to generate a [fixed-code] that is {situation} to the [user-code]. 
        You can use [sample-solution] as a reference when generating the [fixed-code].
        [old-fixed-code]: '{old_fixed_code}'
        [end-old-fixed-code]
        """
        prompt_messages[0]["content"] = prompt_messages[0]["content"] + attachment
    client = OpenAI(api_key=api_token)

    raw_completion_response = client.chat.completions.create(
        model="gpt-5-nano",
        messages = prompt_messages,
        verbosity="low",
    )
    end_marker = "[end-fixed-code]"
    start_marker = "[fixed-code]:\n"

    fixed_code = raw_completion_response.choices[0].message.content

    if fixed_code.endswith(end_marker):
        fixed_code = fixed_code.removesuffix(end_marker).rstrip()
    if fixed_code.startswith(start_marker):
        fixed_code = fixed_code.removeprefix(start_marker).lstrip()
    return fixed_code

def get_fixed_code(api_token, language, problem_description, buggy_code, unittest_code, example_solution, attempt_type, situation, old_fixed_code):
    """
    Get the personalized fixed code for the student's buggy code. It calls generate_personalized_fix to get the fixed code from the LLM.
    Inputs:
        api_token (str): The API token for the LLM.
        language (str): The programming language of the code ("python" or "java").
        problem_description (str): The description of the coding problem.
        buggy_code (str): The student's buggy code.
        unittest_code (str): The unittest code to validate the fixed code.
        example_solution (str): The example solution code.
        attempt_type (str): The type of attempt ("new" or "repeat").
        situation (str): The situation of the attempt ("a correct answer"). This can be extended to other nuanced situations in the future.
        old_fixed_code (str): The old fixed code from the previous attempt (if any).
    Output:
        str: The generated personalized fixed code.
    """
    cleaned_buggy_code = clean_student_code(buggy_code, "")
    print("get_fixed_code-cleaned_buggy_code", cleaned_buggy_code)
    # Future: bring it back if we want to use the cache - also need to add the store_solution_cache.py back
    # cached_solution = get_solution_from_cache(cleaned_buggy_code, db_name="personalized_solution_cache.db")
    # if cached_solution != None:
    #     print("Solution found in cache.",get_solution_from_cache(cleaned_buggy_code))
    #     return get_solution_from_cache(cleaned_buggy_code)
    
    if attempt_type in ["new", "repeat"]:
        prompt_messages = build_code_prompt(language, problem_description, buggy_code, unittest_code, example_solution, system_message, attempt_type)

    fixed_code_response = generate_personalized_fix(api_token, prompt_messages, attempt_type, situation, old_fixed_code)
    print("fixed_code_response", fixed_code_response)
    return fixed_code_response

def get_example_solution(api_token, language, problem_description, unittest_code):
    """
    Get an example solution for the coding problem using the LLM, called when we do not have an instructor-provided example solution.
    Inputs:
        api_token (str): The API token for the LLM.
        language (str): The programming language of the code ("python" or "java").
        problem_description (str): The description of the coding problem.
        unittest_code (str): The unittest code to validate the fixed code.
    Output:
        str: The generated example solution code. Or an empty string if the LLM-generated code does not pass the unittest.
    """
    # call an LLM to get the example solution
    client = OpenAI(api_key=api_token)

    example_solution_system_message = f"""
    You are a helpful {language} coding assistant for CS1/CS2 classes. You only provide correct example solutions that uses the entry-level {language} programming language features.
    Respond ONLY with valid code. Include imports, classes, or functions if needed. Do NOT include explanations, comments, markdown, or test cases.
    """

    example_solution_user_message = f"""
    Generate a correct example solution for the following question in {language}: {problem_description}. 
    Here is the unittest code: {unittest_code}. The solution should be correct and pass the unittest."
    """

    raw_completion_response = client.chat.completions.create(
        model="gpt-5-nano",
        messages=[
            {"role": "system", "content": example_solution_system_message},
            {"role": "user", "content": example_solution_user_message}
        ]
    )

    completion = raw_completion_response.choices[0].message
    LLM_example_code = completion.content
    # test if the LLM_example_code is correct remove all potential #
    LLM_example_code = LLM_example_code.lstrip("#").rstrip("#").strip()
    unittest_result, cleaned_LLM_example_code = unittest_evaluation(language, LLM_example_code, "", "", unittest_case=unittest_code)
    if unittest_result == True:
        # LLM_example_code is correct
        return cleaned_LLM_example_code
    else:
        # LLM_example_code is not correct, return empty string
        return ""
