from openai import OpenAI
import re

from .evaluate_fixed_code import *
from .personalize_common_solution import *
# from .store_solution_cache import *

# A variable to store the API key -- when api_token does not exist
API_key = ""

system_message = """
Fix the provided {programming_language} [user-code] based on the provided [task-description] and [sample-solution] and generate the [fixed-code]. 
The [fixed-code] should pass the provided [unittest-code] and be more similar to the [user-code] than the [sample-solution].
When possible, the [fixed-code] should follow the existing solving strategy and solution path in [user-code], use the same type of [control_structures], use the same variable names as [user-code]. The [fixed-code] should require the least amount of edits from the [user-code].
For example, the [user-code] uses [control_structures], the [fixed-code] should also use these [control_structures] when establishing the solution.
The [fixed-code] should follow the {programming_language} style guide.
[task-description]: '{question_description}'
[end-task-description]

[sample-solution]: '{Example_student_solution}'
[end-solution]

[unittest-code]: '{Unittest_Code}'
[end-unittest-code]

[control-structures]: '{control_structures}'
[end-control-structures]
"""

low_level_system_message = """
The {programming_language} [user-code] is incorrect. Follow the [task-description] to generate a [fixed-code] from the correct [sample-solution].
The [fixed-code] should keep the critical components of the [sample-solution] to ensure correctness and consistency. Adjustments should only be made to use the same [variable-names] as [user-code] when possible, such as descriptive variables, loop variables, boolean variables.
The priority is to meet all the requirements of the [task-description], pass the [unittest-code], and follow the {programming_language} style guide.
Do not change important elements of the [sample-solution]. Do not refer to the solving strategy and solution path in [user-code] when generating the [fixed-code]. Use the [sample-solution] as a reference.
[task-description]: '{question_description}'
[end-task-description]

[sample-solution]: '{Example_student_solution}'
[end-solution]

[unittest-code]: '{Unittest_Code}'
[end-unittest-code]

[variable-names]: '{variable_names}'
[end-variable-names]
"""

# user message here is the example student answer
user_message = """[user-code]:
{Example_buggy_code}
[end-user-code]"""

assistant_message = """[fixed-code]:
{Example_fixed_code}
[end-fixed-code]"""

def find_control_structures_java(buggy_code):
    control_structures_java = []

    # Regular expressions for different control structures and loops
    regex_for = r'for\s*\(\s*.*?\s*\)\s*\{'
    regex_while = r'while\s*\(\s*.*?\s*\)\s*\{'
    regex_if_elif = r'if\s*\(.*?\)\s*\{|\belse if\b\s*\(.*?\)\s*\{'
    regex_if_else = r'if\s*\(.*?\)\s*\{|\belse\b\s*\{'

    # Check for each regex pattern in the code snippet
    if re.search(regex_for, buggy_code):
        control_structures_java.append("for-loop")
    if re.search(regex_while, buggy_code):
        control_structures_java.append("while-loop")
    if re.search(regex_if_elif, buggy_code):
        control_structures_java.append("if-or-elif-condition")
    if re.search(regex_if_else, buggy_code):
        control_structures_java.append("if-or-else-condition")

    return control_structures_java

def find_control_structures(buggy_code):
    control_structures = []

    # Regular expressions for different control structures and loops
    regex_for = r'for\s+\w+\s+in\s+\w+\s*:'
    regex_while = r'while\s+\w+\s*:'
    regex_for_range = r'for\s+\w+\s+in\s+range\('
    regex_for_items = r'for\s+\w+\s*,\s*\w+\s+in\s+\w+\.items\(\)'
    regex_if_elif = r'if\s+\w+\s*:\s*|elif\s+\w+\s*:'
    regex_if_else = r'if\s+\w+\s*:\s*|else\s*:'

    # Check for each regex pattern in the code snippet
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

def build_code_prompt(language, question_line, buggy_code, system_message, attempt_type, user_message=user_message,assistant_message=assistant_message):
    
    user_message = user_message.format(
        Example_buggy_code = question_line["Example_buggy_code"].values[0]
    )
    print("attempt_type_here", attempt_type)

    if attempt_type in ["new", "repeat"]:
        if language == "java":
            control_structures = find_control_structures_java(buggy_code)
        else:
            control_structures = find_control_structures(buggy_code)

        system_message = system_message.format(
        programming_language = language,
        question_description = question_line["w_question_description"].values[0],
        Example_student_solution = question_line["Example_student_solution"].values[0],
        Unittest_Code = question_line["Unittest_Code"].values[0],
        control_structures = control_structures
        )

        Example_fixed_code = question_line["Example_fixed_code"].values[0]

    elif attempt_type == "low-level":
        # For low-level fixes, we extract syntax-level elements, primarily focusing on variable names.
        variable_names = extract_variables(language, buggy_code)

        system_message = system_message.format(
        programming_language = language,
        question_description = question_line["w_question_description"].values[0],
        Example_student_solution = question_line["Example_student_solution"].values[0],
        Unittest_Code = question_line["Unittest_Code"].values[0],
        variable_names = variable_names
        )
        Example_fixed_code = question_line["Example_low_level_fixed_code"].values[0]

    assistant_message = assistant_message.format(
        Example_fixed_code = Example_fixed_code
    )

    prompt_code = "[user-code]:\n" + buggy_code + "\n[end-user-code]"
    # Use few-shot prompting to provide context & examples
    prompt_messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": assistant_message},
                {"role": "user", "content": prompt_code},
            ]
    # print("prompt_messages here: \n", prompt_messages)
    return prompt_messages
        
def generate_personalized_fix(api_token, prompt_messages, attempt_type, situation, old_fixed_code):
    if attempt_type in ["new", "low-level"]:
        prompt_messages = prompt_messages
    elif attempt_type == "repeat":
        attachment = f"""
        This [old-fixed-code] is not {situation} to the [user-code]. Again, please try to generate a [fixed-code] that is {situation} to the [user-code]. You can use [sample-solution] as a reference when generating the [fixed-code].
        [old-fixed-code]: '{old_fixed_code}'
        [end-old-fixed-code]
        """
        prompt_messages[0]["content"] = prompt_messages[0]["content"] + attachment
    # print("prompt_messages", prompt_messages)
    client = OpenAI(api_key=api_token)

    raw_completion_response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,  # Adjust this value to control randomness
        messages = prompt_messages,
        stop = ["[end-fixed-code]"],
        top_p=0.95,
        frequency_penalty=0,
        presence_penalty=0,
        seed=1234,
        )
    
    completion = raw_completion_response.choices[0].message
    fixed_code = completion.content
    return fixed_code


def get_fixed_code(api_token, language, df_question_line, buggy_code, default_test_code, attempt_type, situation, old_fixed_code):
    # first check if the buggy code is in the cache
    cleaned_buggy_code = clean_student_code(buggy_code, default_test_code)
    print("get_fixed_code-cleaned_buggy_code", cleaned_buggy_code)
    # TODO: bring it back if we want to use the cache - also need to add the store_solution_cache.py back
    # cached_solution = get_solution_from_cache(cleaned_buggy_code, db_name="personalized_solution_cache.db")
    # if cached_solution != None:
    #     print("Solution found in cache.",get_solution_from_cache(cleaned_buggy_code))
    #     return get_solution_from_cache(cleaned_buggy_code)
    
    if attempt_type in ["new", "repeat"]:
        prompt_messages = build_code_prompt(language, df_question_line, buggy_code, system_message, attempt_type)
    elif attempt_type == "low-level":
        prompt_messages = build_code_prompt(language, df_question_line, buggy_code, low_level_system_message, attempt_type)

    # Make the API request using the current_api_key
    fixed_code_response = generate_personalized_fix(api_token, prompt_messages, attempt_type, situation, old_fixed_code)
    print("fixed_code_response", fixed_code_response)
    return fixed_code_response






