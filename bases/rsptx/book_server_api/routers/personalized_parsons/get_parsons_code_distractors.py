
def generate_code_with_distrator(unchanged_lines, fixed_lines, distractor_tuple):
    unchanged_lines = [(line[0], line[1], line[2]) for line in unchanged_lines if line[2].strip()]
    fixed_lines = [(line[0], line[1], line[2]) for line in fixed_lines if line[2].strip()]
    other_lines = unchanged_lines + fixed_lines
    key_fixed_line = distractor_tuple[0]
    fixed_line_code = key_fixed_line[2]
    line_indentation = fixed_line_code[:len(fixed_line_code) - len(fixed_line_code.lstrip())]
    distractor_line = distractor_tuple[1]
    # if distractor_dict[key_fixed_line] has a value, then remove the corresponding distractor_dict[key_fixed_line] from the fixed_lines
    #print("other_lines",other_lines, "key_fixed_line", key_fixed_line)
    for i, other_line in enumerate(other_lines):
        if key_fixed_line[2] == other_line[2]:
            #print("pop", key_fixed_line, other_line[2])
            other_lines.pop(i)
        else:
            continue
    #print("after-pop", other_lines)
    blocks = other_lines + [(key_fixed_line[0]+0.5, key_fixed_line[0], line_indentation + distractor_line.strip())]
    # Sort the blocks by their starting line number
    blocks = sorted(blocks, key=lambda x: x[0])
    
    # Extract the last element of each tuple and store them in a string
    actual_code_blocks = [t[-1] for t in blocks]
    code_with_distrator = '\n'.join(actual_code_blocks)

    #print("code_with_single_distrator", code_with_distrator)
    return code_with_distrator