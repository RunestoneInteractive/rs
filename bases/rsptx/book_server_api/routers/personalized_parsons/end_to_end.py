# import necessary packages
import time
import traceback
import threading
import concurrent.futures as futures
from concurrent.futures import ProcessPoolExecutor, wait, FIRST_COMPLETED, ThreadPoolExecutor
import time
import signal

from .buggy_code_checker import buggy_code_checker
from .get_personalized_solution import *
from .evaluate_fixed_code import *
from .generate_parsons_blocks import *
from .personalize_parsons import *
from .token_compare import *
from .get_parsons_code_distractors import *


# Include: Problem Name, Question Description, Cluster
# Example_student_solution, Example_buggy_code, Example_fixed_code
# The function in coach.py -- get_parsons_help(api_token, language, input_dict, df_question_bank, personalize_level)

def get_parsons_help(api_token, language, dict_buggy_code, df_question_bank, personalize_level):
    df_question_line = df_question_bank[df_question_bank["Problem Name"] == dict_buggy_code["Problem Name"]]
    df_question_line.index = [0]
    problem_description = df_question_line["w_question_description"][0].replace("\\n", "\n")
    # Extract useful code pieces from prepared data
    buggy_code = dict_buggy_code["CF (Code)"].replace("\\n", "\n")
    default_start_code = df_question_line["Default_Starting_Code"][0].replace("\\n", "\n")
    default_test_code = df_question_line["Default_Test_Code"][0].replace("\\n", "\n")
    most_common_code = df_question_line["Example_student_solution"][0].replace("\\n", "\n")
    unittest_code = df_question_line["Unittest_Code"][0].replace("\\n", "\n")
    # check if language is java, keep it as it is, otherwise, assign it to "python" as default
    if language.lower() == "java" or language.lower() == "python":
        language = language.lower()
    else:
        language = "python"  # Default to python if not specified
    print("default_test_code", default_test_code)
    if personalize_level == "Solution" or personalize_level == "Multiple":
        solution_generation_type, cleaned_fixed_code, generation_result_type = generate_personalized_fixed_code(api_token, language, df_question_line, buggy_code, default_start_code, default_test_code, most_common_code, unittest_code)
        final_fixed_code = cleaned_fixed_code.lstrip()
        print('personalized_end_cleaned_fixed_code\n', solution_generation_type, final_fixed_code, generation_result_type)
    elif personalize_level == "Common":
        solution_generation_type, generation_result_type = "most_common", "most_common"
        final_fixed_code = most_common_code.lstrip()
    else:
        return "Error: invalid personalize_level"
    
    if personalize_level == "Solution" or personalize_level == "Common":
        # generate Parsons problems with personalization only at the solution level
        final_Parsons_block = generate_full_Parsons(language, final_fixed_code, problem_description)
    elif personalize_level == "Multiple":
        # let this function determine the personalization level — it can potentially become a full Parsons puzzle
        final_Parsons_block = generate_multi_personalized_Parsons_blocks(language, df_question_line, buggy_code, final_fixed_code, default_start_code, default_test_code, unittest_code)
    else:
        return "Error: invalid personalize_level"
    
    return final_fixed_code, final_Parsons_block, solution_generation_type, generation_result_type

def timeout_handler(signum, frame):
    """Signal handler that raises a TimeoutError when the alarm goes off."""
    raise TimeoutError("Timeout reached for OpenAI API request")


#generate the fixed code
def request_fixed_code_from_openai(api_token, language, solution_generation_type, df_question_line, buggy_code, default_start_code, default_test_code, most_common_code, unittest_code, solution_generation, old_fixed_code, attempt_type, situation, failure_reason, unittest_result):
    """
    Request a fixed code from GenerativeAI based on the buggy code and other parameters.
    Args:
        api_token: The API token for GenerativeAI -- now only support OpenAI
        language: The programming language of the code - Python or Java
        solution_generation_type: The type of solution generation, e.g., "main_personalized", "low_level_personalized"
        df_question_line: DataFrame containing the question line information
        buggy_code: The buggy code provided by the student
        default_start_code: The default starting code for the question
        default_test_code: The default test code for the question
        most_common_code: The most common code solution for the question
        unittest_code: The unittest code for the question
        solution_generation: The current generation attempt number -- starts from 2, ends at 0
        old_fixed_code: The previously generated fixed code, if any
        attempt_type: The type of attempt, e.g., "new", "repeat", "low-level" - the openai request might be different based on the attempt_type
        situation: The situation for the request, e.g., "a correct answer"
        failure_reason: The reason for the failure, e.g., "not correct"
        unittest_result: The result of the unittest evaluation for the buggy code
    Returns:
        A tuple containing the solution generation type, the cleaned fixed code, and the generation result type.
    """
    print("before-start-this-round:", unittest_result)
    cleaned_buggy_code = clean_student_code(buggy_code, default_test_code)
    if solution_generation <= 0:
        print("solution_generation_type", solution_generation_type, solution_generation, most_common_code.lstrip(), "most_common")
        return solution_generation_type, most_common_code.lstrip(), "most_common"
    
    # For solution_generation >= 1, fix the code and run tests
    fixed_code = get_fixed_code(language, df_question_line, buggy_code, default_test_code, attempt_type=attempt_type, situation=situation, old_fixed_code=old_fixed_code)
    unittest_result, cleaned_fixed_code = unittest_evaluation(language, fixed_code, default_start_code, default_test_code, unittest_case=unittest_code)

    if not unittest_result:
        return solution_generation_type, most_common_code.lstrip(), "most_common"

    if unittest_result == True:
        # A student's own approach - include logic-level (e.g., logic / strategy) and syntax-level (e.g., variable names, control flow structures)
        # Main personalization: aims to personalize the fix on both problem-solving strategy and syntax-levels
        # Low-level personalization: aims to personalize the fix mainly on syntax-level -- sometimes the student's own logic might be partially incorrect or ambiguous, so deeper personalization may lead to incorrect fixes.
        if solution_generation_type == "low_level_personalized":
            # Because low-level personalization follows the example logic, when it is correct, we can return the fixed code directly, no need to compare with most_common_code
            return solution_generation_type, cleaned_fixed_code.lstrip(), "AI_personalized"

        similarity_personalized = code_similarity_score(cleaned_buggy_code, cleaned_fixed_code)
        similarity_most_common = code_similarity_score(cleaned_buggy_code, most_common_code)
        
        if solution_generation_type == "main_personalized":
            if similarity_personalized >= similarity_most_common:
                return solution_generation_type, cleaned_fixed_code.lstrip(), "AI_personalized"
            else:
                return solution_generation_type, most_common_code.lstrip(), "Most_common_personalized"
            
        # For other cases, return the more similar one as the personalized result
        if similarity_personalized >= similarity_most_common:
            return solution_generation_type, cleaned_fixed_code.lstrip(), "AI_personalized"
        else:
            return solution_generation_type, most_common_code.lstrip(), "Most_common_personalized"

    else:
        print("not correct, retrying ... current solution_generation=", solution_generation)
        # If the unittest result is not correct, we will retry with the same solution_generation_type, but will provide the incorrect code as part of the system message (attachment)
        solution_generation -= 1
        return request_fixed_code_from_openai(language, solution_generation_type, df_question_line, buggy_code, default_start_code, default_test_code, most_common_code, unittest_code, solution_generation, old_fixed_code=cleaned_fixed_code, attempt_type="repeat", situation="a correct answer", failure_reason="not correct", unittest_result = False)
    

def generate_personalized_fixed_code(api_token, language, df_question_line, buggy_code, default_start_code, default_test_code, most_common_code, unittest_code, API_attempt=0):
    """
    Generate a personalized fixed code based on the buggy code and other parameters.
    Args:
        api_token: The API token for GenerativeAI -- now only support OpenAI
        language: The programming language of the code - Python or Java
        df_question_line: DataFrame containing the question line information
        buggy_code: The buggy code provided by the student
        default_start_code: The default starting code for the question
        default_test_code: The default test code for the question
        most_common_code: A common code solution for the question (can be an example solution in practice)
        unittest_code: The unittest code for the question
        API_attempt: The current API attempt number, not include in the current logic, but can be used for debugging or retrying purposes
    Returns:
        A tuple containing the solution generation type, the cleaned fixed code, and the generation result type.
    """

    print('buggy_code_checker', bool(buggy_code_checker(language, buggy_code, default_start_code, default_test_code)))
    # check if students contributed any code -- If it is True, then check the correctness
    if bool(buggy_code_checker(language, buggy_code, default_start_code, default_test_code)):
        # check whether the existing code is already correct
        unittest_result, cleaned_buggy_but_correct_code = unittest_evaluation(language, buggy_code, default_start_code, default_test_code, unittest_case=unittest_code)
        print("unittest_result", unittest_result, cleaned_buggy_but_correct_code)
        if unittest_result != True:
            print("Starting turn here - trying personalized solution...")

            main_timeout = 6  # Global Timeout (seconds)
            timeout = 5 # Timeout for personalized request (seconds)

            if threading.current_thread() is threading.main_thread():
                signal.signal(signal.SIGALRM, timeout_handler)  # Set signal handler
                signal.alarm(main_timeout)  # Start global timeout
            
            try:
                with futures.ThreadPoolExecutor() as executor:
                    # Submit the personalized request
                    future_personalized = executor.submit(
                        request_fixed_code_from_openai, api_token, language, "main_personalized", df_question_line, buggy_code, default_start_code, default_test_code, most_common_code, unittest_code, solution_generation=2, old_fixed_code="", attempt_type="new", situation="", failure_reason="", unittest_result=""
                    )
                    future_low_level_common_solution = executor.submit(
                        request_fixed_code_from_openai, api_token, language, "low_level_personalized", df_question_line, buggy_code, default_start_code, default_test_code, most_common_code, unittest_code,  solution_generation=1, old_fixed_code="", attempt_type="low-level", situation="concurrent-low-level", failure_reason="", unittest_result=""
                    )
                    
                    # Start a timer to manage timeout logic
                    start_time = time.time()
                    
                    # Start polling to check if any future is done within the timeout
                    while True:

                        elapsed_time = time.time() - start_time

                        # Return immediately if `future_personalized` is done
                        if future_personalized.done():
                            print("elapsed_time", elapsed_time)
                            result_main_personalized = future_personalized.result()
                            print("Personalized result:", result_main_personalized)
                            # TODO: if want to cache the main personalized solution, uncomment the following line
                            # if result_main_personalized[-1] != "most_common":
                            #     add_personalized_code(cleaned_buggy_code, result_main_personalized[1], db_name="personalized_solution_cache.db")
                            return result_main_personalized

                        if elapsed_time > timeout:
                            # If timeout reached, move to low-level solution and check
                            print(time.time() - start_time, "Timeout reached for personalized, switching to low-level solution...")
                            if future_low_level_common_solution.done():
                                result_low_level = future_low_level_common_solution.result()
                                print(time.time() - start_time, "Low-level solution result:", result_low_level)
                                return result_low_level
                            else:
                                print(time.time() - start_time, f"Neither task completed within {timeout} seconds. Returning most_common.")
                                return f"task_timed_out_{timeout}", most_common_code.lstrip(), "most_common"
                        # Sleep briefly to avoid over-polling (small delay to allow task execution)
                        time.sleep(0.02)  # Adjustable for better granularity or efficiency
            
            except TimeoutError:
                print(f"Global timeout reached ({main_timeout}s). Returning most_common.")
                return f"task_timed_out_{main_timeout}", most_common_code.lstrip(), "most_common"

            finally:
                if threading.current_thread() is threading.main_thread():
                    signal.alarm(0)  # Disable alarm to prevent unwanted interruptions
        # If the code is correct, we will return the cleaned_buggy_but_correct_code
        else:
            return "written_code_correct", cleaned_buggy_but_correct_code.lstrip(), "written_code"
    # If the code is empty, return the most common code
    else: 
        return "empty_beginning", most_common_code.lstrip(), "most_common"


def generate_multi_personalized_Parsons_blocks(language, df_question_line, buggy_code, fixed_code, default_start_code, default_test_code, unittest_code):
    """
    Generate personalized Parsons blocks based on the buggy code and fixed code.
    Args:
        langage: The programming language of the code - Python or Java
        df_question_line: DataFrame containing the question line information
        buggy_code: The buggy code provided by the student
        fixed_code: The fixed code generated by the AI / instructor
        default_start_code: The default starting code for the question
        default_test_code: The default test code for the question
        unittest_code: The unittest code for the question
    Returns:
        A personalized Parsons block with distractors when applicable.
    """
    buggy_code_for_blocks = clean_student_code(buggy_code, default_test_code)
    # generate the Parsons blocks
    # add paired distractors on their code when there are some meaningful comparison (one line similarity > a threshold)
    code_comparison_pairs, fixed_lines, removed_lines, unchanged_lines, total_similarity = compare_code(buggy_code_for_blocks, fixed_code, default_start_code)

    # decide the types of Parsons problems and generate correspoding distractors
    Parsons_type, distractors = personalize_Parsons_block(df_question_line, code_comparison_pairs, buggy_code, fixed_lines, removed_lines, unchanged_lines, total_similarity)
    unittest_flag = True
    print("Parsons_type", Parsons_type, "distractors", distractors)
    if len(distractors) > 0:
        for distractor in distractors.copy().items():
            distractor_correct_line = distractor[0]
            # Prepare the code with distractors for unittest evaluation - should not pass the tests this time
            code_with_distrator = generate_code_with_distrator(unchanged_lines, fixed_lines, distractor)
            #print("code_with_distractors\n", code_with_distrator)
            unittest_flag, cleaned_code_with_distractors = code_distractor_unittest_evaluation(language, code_with_distrator, default_start_code, default_test_code, unittest_code)
            # If the code with distractors passes the unittest, we will remove the distractor from the distractors list
            # TODO: this does not work for Java yet, only works for Python
            if unittest_flag == True:
                distractors.pop(distractor_correct_line)

    personalized_Parsons_block = generate_Parsons_block(language, Parsons_type, df_question_line, fixed_code, unchanged_lines, fixed_lines, distractors)
    print("personalized_Parsons_block\n", personalized_Parsons_block)
    return personalized_Parsons_block