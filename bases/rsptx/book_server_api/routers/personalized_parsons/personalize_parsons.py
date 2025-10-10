import difflib
from collections import namedtuple
from .generate_parsons_blocks import *
from .token_compare import *
import random

# Compare the similarity between the student code and the fixed code
# It returns the difference between the two code snippets line by line using a loop. It also returns the similarity ratio.
# The difflib module compares lines based on their content, so it may not capture more complex differences - but we can use it for our case
CodeComparison = namedtuple('CodeComparison', ['student_removed', 'fixed_modified', 'line_similarity'])


def compare_code(buggy_code, fixed_code, default_start_code, language):
    """
    Compare the buggy code with the fixed code and return the differences.
    Inputs:
        buggy_code (str): The student's buggy code.
        fixed_code (str): The correct fixed code.
        default_start_code (str): The default starting code to be ignored in the comparison. It's "" right now.
        language (str): The programming language of the code ('python' or 'java').
    Outputs:
        code_comparison_pairs (list): A list of CodeComparison namedtuples representing the differences between the student buggy and fixed code
                                      Each item includes student_removed (tuple[int, int, str]), fixed_modified (tuple[int, int, str]), line_similarity (float)
        fixed_lines (list): A list of tuples representing the fixed lines in the format (line number, code length, code).
        removed_lines (list): A list of tuples representing the removed lines in the format (line number, code length, code).
        unchanged_lines (list): A list of tuples representing the unchanged lines in the format (line number, code length, code).
        total_similarity (float): The overall similarity score between the buggy code and the fixed code.
    """

    code_comparison_pairs = []

    # split the code into lines
    student_lines = buggy_code.splitlines(keepends=True)
    fixed_lines = fixed_code.splitlines(keepends=True)

    # strip trailing spaces but keep leading spaces
    student_lines = [line.rstrip() for line in student_lines]
    fixed_lines = [line.rstrip() for line in fixed_lines]
    
    # perform a line-based comparison
    diff = list(difflib.Differ().compare(student_lines, fixed_lines))

    # calculate similarity ratio without the starting line if provided
    if default_start_code.strip() == "":
        # this means the total_similarity is calculated based on the whole code and can be unexpectedly high if the starting code is long
        buggy_code_no_starting = buggy_code
        fixed_code_no_starting = fixed_code
    else: 
        buggy_code_no_starting = '\n'.join([line for line in buggy_code.split('\n') if line != default_start_code])
        fixed_code_no_starting = '\n'.join([line for line in fixed_code.split('\n') if line != default_start_code])

    total_similarity = code_similarity_score(buggy_code_no_starting, fixed_code_no_starting, language)

    # Get the line similarity pairs
    line_similarity_pairs = []
    fixed_lines = []
    removed_lines = []
    unchanged_lines = []
    discarded_lines = []
    for i, line in enumerate(diff):
        if line.startswith('+'):
            fixed_lines.append((i, len(line[1:].strip()), line[2:]))
        elif line.startswith('-'):
            removed_lines.append((i, len(line[1:].strip()), line[2:]))
        elif line.startswith('?'):
            discarded_lines.append((i, len(line[1:].strip()), line[2:]))
        else:
            unchanged_lines.append((i, len(line[1:].strip()), line[2:]))

    # pair up the added and removed lines
    max_len = max(len(fixed_lines), len(removed_lines))

    for i in range(max_len):
        try:
            line_similarity_pairs.append((['student', removed_lines[i]], ['fixed', fixed_lines[i]]))
        except IndexError:
            if len(fixed_lines) > len(removed_lines):
                line_similarity_pairs.append((['student', (0, '', '')], ['fixed', fixed_lines[i]]))
            else:
                line_similarity_pairs.append((['student', removed_lines[i]], ['fixed', (0, '', '')]))
            
    # calculate similarity ratio only for different lines
    for i, pair in enumerate(line_similarity_pairs):
        if pair[0][1] != pair[1][1]:
            similarity = code_similarity_score(pair[0][1][2], pair[1][1][2], language)
            pair = CodeComparison(pair[0][1], pair[1][1], similarity)
            code_comparison_pairs.append(pair)
     
    return code_comparison_pairs, fixed_lines, removed_lines, unchanged_lines, total_similarity

def normalize_and_compare_lines(line1, line2, line_similarity):
    """
    Normalize and compare two lines of code.
    Inputs:
        line1 (str): The first line of code.
        line2 (str): The second line of code.
        line_similarity (float): The similarity score between the two lines.
    Output:
        bool: True if the lines are identical after normalization, False otherwise.
    """
    if line_similarity == 1:
        return True
    # normalize indentation
    indentation1 = re.match(r'^(\s*)', line1).group(1)
    indentation2 = re.match(r'^(\s*)', line2).group(1)
    line1_normalized = line1.replace(indentation1, '')
    line2_normalized = line2.replace(indentation2, '')

    # remove extra whitespaces
    line1_cleaned = re.sub(r'\s+', '', line1_normalized).strip()
    line2_cleaned = re.sub(r'\s+', '', line2_normalized).strip()

    # compare normalized lines, highlight the indentation differences
    if line1_cleaned != line2_cleaned:
        return False
    elif (line1_cleaned == line2_cleaned) and (indentation1!=indentation2):
        return False
    elif (line1_cleaned == line2_cleaned) and (indentation1 == indentation2):
        return True

def find_distractor(fixed_line, removed_lines, language):
    """
    Find a distractor line from the removed lines that is similar to the fixed line.
    Inputs:
        fixed_line (str): The fixed line of code.
        removed_lines (list): A list of tuples representing the removed lines in the format (line number, code length, code).
        language (str): The programming language of the code ('python' or 'java').
    Outputs:
        highest_similarity (float): The similarity threshold of the distractor line.
        distractor_line (str or bool): The distractor line if found, False otherwise.
    """
    removed_lines = [tup[2] for tup in removed_lines]
    highest_similarity = 0.70
    distractor_line = False
    # check whether there is any line achieved a high similarity than the line of comparable location
    for student_line in removed_lines:
        similarity = code_similarity_score(student_line, fixed_line, language)
        normalized_line_comparision = normalize_and_compare_lines(student_line, fixed_line, similarity)
        if (similarity > highest_similarity) & (similarity != 1) & (normalized_line_comparision==False):
            highest_similarity = similarity
            distractor_line = student_line

    return highest_similarity, distractor_line


def generate_unique_distractor_dict(distractor_dict):
    """
    Generate a unique distractor dictionary by selecting the highest similarity distractor.
    Input:
        distractor_dict (dict): A dictionary where keys are fixed lines and values are tuples of (similarity_score, distractor_line).
    Output:
        result_distractor_dict (dict): A dictionary where keys are fixed line tuples and values are distractor lines.
    """

    value_groups = {}
    for key, value in distractor_dict.items():
        _, code = value
        if code not in value_groups:
            value_groups[code] = []
        value_groups[code].append((key, value))

    # select the highest similarity value for each value[1]
    result_distractor_dict = {}
    for code, group in value_groups.items():
        highest_similarity = max(group, key=lambda x: x[1][0])
        result_distractor_dict[highest_similarity[0]] = highest_similarity[1][1]    

    return result_distractor_dict

def find_control_flow_lines(distractor_candidate_depot):
    """
    Find control flow lines in the distractor candidate depot.
    """
    # each element in distractor_candidate_depot is like (location, length, actual code)
    flow_keywords = ['if', 'else', 'elif', 'for', 'while', "==", "!=", "<", ">"]
    flow_lines = []
    
    for element in distractor_candidate_depot:
        for keyword in flow_keywords:
            pattern = rf'\b{re.escape(keyword)}\b'
            if re.search(pattern, element[2]):
                flow_lines.append(element)
                break
    return flow_lines


def get_distractor_candidates(distractor_candidate_depot, candidate_num):
    """
    Get distractor candidates from the distractor candidate depot.
    Inputs:
        distractor_candidate_depot (list): A list of tuples representing the distractor candidate lines in the format (line_number, length, code).
        candidate_num (int): The number of distractor candidates to select.
    Output:
        distractor_candidates (list): A list of tuples representing the selected distractor candidates.
    """
    # each element in distractor_candidate_depot is like (location, length, actual code)
    distractor_candidates = []
    control_flow_lines = find_control_flow_lines(distractor_candidate_depot)
    # select all the lines from the code that contains control flow keywords
    # if the find_control_flow_lines are more than candidate_num, randomly select candidate_num lines
    if len(control_flow_lines) >= candidate_num:
        distractor_candidates = random.sample(control_flow_lines, candidate_num)
    # if there do have some control flow lines, but less than candidate_num, get all the control flow lines into distractor_candidates
    # and add more lines from the top N longest lines
    elif (len(control_flow_lines) < candidate_num) and (len(control_flow_lines) > 0):
        distractor_candidates = control_flow_lines
        distractor_candidates = distractor_candidates + sorted(distractor_candidate_depot, key=lambda x: x[1], reverse=True)[:candidate_num-len(control_flow_lines)]
    else:
        distractor_candidates = sorted(distractor_candidate_depot, key=lambda x: x[1], reverse=True)[:candidate_num]
    
    return distractor_candidates


def personalize_Parsons_block(language, problem_description, code_comparison_pairs, buggy_code, fixed_lines, removed_lines, unchanged_lines, total_similarity):
    """
    Decide which type of Parsons puzzle we will generate and generate the corresponding distractors.
    Inputs:
        problem_description (str): The description of the problem.
        code_comparison_pairs (list): A list of CodeComparison namedtuples representing the differences
        buggy_code (str): The student's buggy code.
        fixed_lines (list): A list of tuples representing the fixed lines in the format (line_number, code length, code).
        removed_lines (list): A list of tuples representing the removed lines in the format (line_number, code length, code).
        unchanged_lines (list): A list of tuples representing the unchanged lines in the format (line_number, code length, code)
        total_similarity (float): The overall similarity score between the buggy code and the fixed code.
    Outputs:
        puzzle_type (str): The type of Parsons puzzle to generate ("Full", "Correct", "Partial").
        distractors (dict): A dictionary where keys are fixed line tuples and values are distractor lines.
    """
    distractors = {}

    if total_similarity < 0.20: # if the total similarity is too low, then we won't generate any distractors
        return "Full", {}
    elif total_similarity >= 0.99:
        return "Correct", {} 
    else:
        # use students' own buggy code as resource to build distractors
        for pair in code_comparison_pairs:
            normalize_and_compare = normalize_and_compare_lines(pair[0][2], pair[1][2],pair[2])
            if normalize_and_compare == False:
                # if the student code is wrong (not just a different way to write the same code), generate a distractor using student buggy code
                distractor_similarity, distractor = find_distractor(pair[1][2], removed_lines, language)
                if distractor != False:
                    distractors[pair[1]] =  (distractor_similarity, distractor)
                else:
                    continue 
        # check to make sure all the paired distractors are different, if some are same, pop up the key value with the least similarity - leave it as a movable line
        if len(distractors) > 0:
            distractors = generate_unique_distractor_dict(distractors)
        else:
            distractors = {}
        return "Partial", distractors
    