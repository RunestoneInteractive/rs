import unittest
import pandas as pd
import re
import difflib
from fuzzywuzzy import fuzz
from types import ModuleType
import difflib
import threading
import signal
import subprocess
import tempfile
import os
import shutil

class NullOutput:
    def write(self, _):
        pass
    def flush(self):
        pass

class TimeoutError(Exception):
    pass

def handler(signum, frame):
    raise TimeoutError("Test execution exceeded time limit")

def load_and_run_java_tests(java_code, test_code):
    def extract_class_name(code):
        match = re.search(r'public\s+class\s+(\w+)', code)
        if match:
            return match.group(1)
        else:
            raise ValueError("Could not find a public class declaration.")

    temp_dir = tempfile.mkdtemp()
    try:
        # Extract class names from the code
        class_name = extract_class_name(java_code)
        test_class_name = extract_class_name(test_code)

        # Write main Java file
        code_path = os.path.join(temp_dir, f"{class_name}.java")
        with open(code_path, "w") as f:
            f.write(java_code)

        # Write test Java file
        test_path = os.path.join(temp_dir, f"{test_class_name}.java")
        with open(test_path, "w") as f:
            f.write(test_code)

        # Compile both
        compile_result = subprocess.run(
            ["javac", f"{class_name}.java", f"{test_class_name}.java"],
            cwd=temp_dir,
            capture_output=True,
            text=True
        )
        if compile_result.returncode != 0:
            print("Compilation error:\n", compile_result.stderr)
            return False

        # Run the test class
        run_result = subprocess.run(
            ["java", test_class_name],
            cwd=temp_dir,
            capture_output=True,
            text=True
        )
        print("Detected class_name:", class_name)
        print("Detected test_class_name:", test_class_name)

        print("Java exited with code:", run_result.returncode)
        print("stdout:\n", run_result.stdout)
        print("stderr:\n", run_result.stderr)

        if run_result.returncode == 0:
            return True
        else:
            return False

    except Exception as e:
        print("Error while running Java tests:", str(e))
        return False
    finally:
        shutil.rmtree(temp_dir)

def load_and_run_tests(unittest_case, code_to_test, time_limit=5):
    if threading.current_thread() is threading.main_thread():
        signal.signal(signal.SIGALRM, handler)
        signal.alarm(time_limit)

    try:
        # Create a dummy module to hold the test cases
        test_module = ModuleType("test_module")
        test_module.unittest = unittest

        # Execute the test cases string within the dummy module's namespace
        exec(unittest_case, test_module.__dict__)
        # Execute the code to test within the desired scope
        exec(code_to_test, test_module.__dict__)
        # Retrieve the loaded test cases
        test_suite = unittest.TestLoader().loadTestsFromModule(test_module)
        print("test_suite",test_suite)
        # Run the test suite
        test_results = unittest.TextTestRunner(verbosity=0, failfast=True, stream=NullOutput()).run(test_suite)
        print("test_results",test_results)
    
    except TimeoutError:
        print("test_results", test_results)
        return False
    finally:
        signal.alarm(0)

    return test_results



def fix_indentation(text):
    lines = text.split('\n')

    # Remove leading whitespace for the first line
    if lines:
        lines[0] = lines[0].lstrip()
    
    # Find the indentation of the first def/class line
    indentation = 0
    for line in lines:
        if line.strip().startswith(('def ', 'class ')):
            indentation = len(line) - len(line.lstrip())
            break
    
    # Remove indentation for subsequent lines
    for i in range(1, len(lines)):
        lines[i] = lines[i][indentation:]
    
    return '\n'.join(lines)

def contain_default_starting_code(default_code, code, similarity_threshold=0.95):
    if pd.isna(default_code)== True:
        return True
    else:
        # Remove leading whitespace from each line in the subset and code
        default_code = '\n'.join(line.lstrip() for line in default_code.split('\n') if line.strip())
        code_stripped = '\n'.join(line.lstrip() for line in code.split('\n') if line.strip())
        # Remove whitespace within strings
        default_code_no_whitespace = re.sub(r'(?<=\S)\s+(?=\S)', '', default_code)
        code_stripped_no_whitespace = re.sub(r'(?<=\S)\s+(?=\S)', '', code_stripped)

        if default_code_no_whitespace in code_stripped_no_whitespace:
            return True
        else:
            default_lines = [line.lstrip() for line in default_code.split('\n') if line.strip()]
            code_lines = [line.lstrip() for line in code.split('\n') if line.strip()]
            code_before_last_default_code_line = code_lines[: code_lines.index(default_lines[-1])]
            # Calculate similarity ratio using difflib
            similarity_ratio = difflib.SequenceMatcher(None, default_lines, code_before_last_default_code_line).ratio()
            return similarity_ratio >= similarity_threshold

def extract_code_line(code):
    fixed_pattern = r'\[fixed-code\]:\s*([\s\S]*)'

    if re.findall(fixed_pattern, code, re.DOTALL):
        fixed_code =  re.findall(fixed_pattern, code, re.DOTALL)[0].strip()
        # if the content inside of [fixed-code] does not start with def
    else:
        fixed_code = code

    fenced_pattern = r'```(.*?)```'

    if re.findall(fenced_pattern, fixed_code, flags=re.DOTALL):
        extracted_content = re.findall(fenced_pattern, fixed_code, flags=re.DOTALL)
        fixed_code =  '\n'.join(extracted_content)
    else:
        fixed_code = fixed_code

    if not fixed_code.startswith(('def', 'import', 'class')):
        if re.findall(r'(?:def|public|class|import)(.*)', fixed_code, re.DOTALL):
            match = re.search(r"(public|class|import|def)", fixed_code)
            if match:
                fixed_code = fixed_code[match.start():]
        else:
            fixed_code = fixed_code
    else:
        fixed_code = fixed_code
    
    return fixed_code
    

def remove_potential_default_lines(default_code, code):
    lines = code.split('\n')

    
    if pd.isna(default_code)== True:
        return  '\n'.join(filtered_lines)
    else:
        default_lines = default_code.split('\n')
        filtered_lines = []
        in_function = False
        for line in lines:
            similarity_scores = [fuzz.ratio(line, default_line) for default_line in default_lines]
            max_similarity = max(similarity_scores) if similarity_scores else 0
            if max_similarity > 80:
                if in_function:
                    if line.strip().startswith('def ') and line.strip().endswith(':'):
                        in_function = False
                else:
                    if any(line.strip() in default_line for default_line in default_lines):
                        in_function = True
                        continue
                    else:
                        filtered_lines.append(line)
            else:
                filtered_lines.append(line)

        return '\n'.join(filtered_lines)

def remove_default_testline(code, default_test_code):
    # Split the lines to remove by newline
    default_test_code_list = default_test_code.strip().split('\n')
    # remove the leading whitespace in front of each item in default_test_code_list
    default_test_code_list = [line.lstrip() for line in default_test_code_list]
    # Remove the lines from the code snippet
    modified_code_snippet = ''
    for line in code.strip().split('\n'):
        if (line.strip() not in default_test_code_list) & ('print' not in line) & (not line.startswith('#')):
            modified_code_snippet += line + '\n'
    ##print("modified_code_snippet\n", modified_code_snippet)
    return modified_code_snippet

def remove_empty_lines(code):
    lines = code.splitlines()
    non_empty_lines = [line for line in lines if line.strip() != ""]
    return "\n".join(non_empty_lines)

def remove_python_comments(code):
    # Split each line and take the part before the "#" symbol
    cleaned_lines = [line.split('#', 1)[0] for line in code.split('\n')]

    # Join the modified lines back to form the cleaned code
    cleaned_code = '\n'.join(cleaned_lines)
    return cleaned_code

def remove_java_comments(code):
    # Remove single-line comments (//)
    cleaned_lines = [line.split('//', 1)[0] for line in code.split('\n')]
    cleaned_code = '\n'.join(cleaned_lines)
    return cleaned_code.strip()


def unittest_evaluation(language, fixed_code, starting_code, default_test_code, unittest_case):
    if language == "java":
        return java_unittest_evaluation(fixed_code, starting_code, default_test_code, unittest_case)
    else:
        return python_unittest_evaluation(fixed_code, starting_code, default_test_code, unittest_case)


def java_unittest_evaluation(fixed_code, starting_code, default_test_code, unittest_case):
    try:
        fixed_code.split('\n')
        fixed_code = extract_code_line(fixed_code)
        fixed_code = remove_empty_lines(fixed_code)
        fixed_code = remove_java_comments(fixed_code)
    except Exception as e:
        return f"No enough code-{e}", fixed_code
    
    try:
        print("fixed_code_test", fixed_code)
        java_test_result = load_and_run_java_tests(fixed_code, unittest_case)
        # if contain_default_starting_code(starting_code, fixed_code):
        print("java_results\n", java_test_result)
        return java_test_result, fixed_code
    except Exception as e:
        return f"We got errors, {e}", fixed_code


def python_unittest_evaluation(fixed_code, starting_code, default_test_code, unittest_case):
    try:
        fixed_code.split('\n')
        fixed_code = extract_code_line(fixed_code)
        fixed_code = remove_default_testline(fixed_code, default_test_code)
        fixed_code = remove_empty_lines(fixed_code)
        fixed_code = remove_python_comments(fixed_code)
        #print("cleaned_fixed_code\n", fixed_code)
    except Exception as e:
        return f"No enough code-{e}", fixed_code
    try:
        ##print("fixed_code_first attempt", fixed_code)
        results = load_and_run_tests(unittest_case, fixed_code)
        # if contain_default_starting_code(starting_code, fixed_code):
        print("results.wasSuccessful()\n", results.wasSuccessful())
        return results.wasSuccessful(), fixed_code
    except Exception as e:
        print("Exception", e)
        fixed_code = remove_potential_default_lines(default_test_code, fixed_code)
        try:
            results = load_and_run_tests(unittest_case, fixed_code)
            if contain_default_starting_code(starting_code, fixed_code):
                ##print("results.wasSuccessful()\n", results.wasSuccessful())
                return results.wasSuccessful(), fixed_code
            else:
                return "No starting code", fixed_code
        except:
            try:
                fixed_code = fix_indentation(fixed_code)
                results = load_and_run_tests(unittest_case, fixed_code)
                #print("fix_indentation", fixed_code)
                if contain_default_starting_code(starting_code, fixed_code):
                    #print("results.wasSuccessful()\n", results.wasSuccessful())
                    return results.wasSuccessful(), fixed_code
                else:
                    return "No starting code", fixed_code
            except Exception as e:
                return f"We got errors, {e}", fixed_code

def code_distractor_unittest_evaluation(language, code_with_distrator, starting_code, default_test_code, unittest_case):
    print("distractor_unittest_evaluation")
    if language == "java":
        try:
            print("unittest_case", unittest_case, "code_with_distrator", code_with_distrator)
            java_test_result = load_and_run_java_tests(code_with_distrator, unittest_case)
            print("java_results\n", java_test_result)
            return java_test_result, code_with_distrator
        except Exception as e:
            return f"We got errors, {e}", code_with_distrator
    else:
        try:
            print("unittest_case", unittest_case, "code_with_distrator", code_with_distrator)
            results = load_and_run_tests(unittest_case, code_with_distrator)
            print("distractor_results.wasSuccessful()\n", results.wasSuccessful())
            if contain_default_starting_code(starting_code, code_with_distrator):
                print("distractor_results.wasSuccessful()\n", results.wasSuccessful())
                return results.wasSuccessful(), code_with_distrator
            else:
                return "No starting code", code_with_distrator
        except:
            print("remove_potential_default_lines")
            code_with_distrator = remove_potential_default_lines(default_test_code, code_with_distrator)
            try:
                results = load_and_run_tests(unittest_case, code_with_distrator)
                if contain_default_starting_code(starting_code, code_with_distrator):
                    return results.wasSuccessful(), code_with_distrator
                else:
                    return "No starting code", code_with_distrator
            except:
                try:
                    print("fix_indentation")
                    code_with_distrator = fix_indentation(code_with_distrator)
                    results = load_and_run_tests(unittest_case, code_with_distrator)
                    print("distractor_results.wasSuccessful()\n", results.wasSuccessful())
                    if contain_default_starting_code(starting_code, code_with_distrator):
                        return results.wasSuccessful(), code_with_distrator
                    else:
                        return "No starting code", code_with_distrator
                except Exception as e:
                    return False, code_with_distrator

def clean_student_code(student_code, default_test_code):
    try:
        student_code.split('\n')
        cleaned_student_code = remove_default_testline(student_code, default_test_code)
        cleaned_student_code = remove_empty_lines(cleaned_student_code)
        cleaned_student_code = remove_python_comments(cleaned_student_code)
    except:
        cleaned_student_code = student_code

    return cleaned_student_code
