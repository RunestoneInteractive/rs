
def generate_code_with_distrator(unchanged_lines, fixed_lines, distractor_tuple):
    """
    Generate code with a single distractor line inserted at the appropriate position.
    Inputs:
        unchanged_lines (list): List of tuples representing unchanged lines in the format (line_number, code_length, code).
        fixed_lines (list): List of tuples representing fixed lines in the format (line_number, code_length, code).
        distractor_tuple (tuple): A tuple containing the fixed line and the distractor line in the format ((line_number, code_length, code), distractor_line).
    Output:
        str: The code with the distractor line inserted.
    """
    unchanged_lines = [(line[0], line[1], line[2]) for line in unchanged_lines if line[2].strip()]
    fixed_lines = [(line[0], line[1], line[2]) for line in fixed_lines if line[2].strip()]
    other_lines = unchanged_lines + fixed_lines
    key_fixed_line = distractor_tuple[0]
    fixed_line_code = key_fixed_line[2]
    line_indentation = fixed_line_code[:len(fixed_line_code) - len(fixed_line_code.lstrip())]
    distractor_line = distractor_tuple[1]
    # if distractor_dict[key_fixed_line] has a value, then remove the corresponding distractor_dict[key_fixed_line] from the fixed_lines
    for i, other_line in enumerate(other_lines):
        if key_fixed_line[2] == other_line[2]:
            other_lines.pop(i)
        else:
            continue
    blocks = other_lines + [(key_fixed_line[0]+0.5, key_fixed_line[0], line_indentation + distractor_line.strip())]
    # sort the blocks by their starting line number
    blocks = sorted(blocks, key=lambda x: x[0])
    
    # extract the last element of each tuple and store them in a string
    actual_code_blocks = [t[-1] for t in blocks]
    code_with_distrator = '\n'.join(actual_code_blocks)
    
    return code_with_distrator