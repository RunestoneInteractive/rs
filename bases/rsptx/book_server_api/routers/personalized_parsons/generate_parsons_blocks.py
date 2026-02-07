import re
from collections import OrderedDict


def check_indentation_level(line):
    """Check the indentation level of a line."""
    match = re.match(r"^(\s*)", line)
    indentation_level = len(match.group(1))
    return indentation_level


# generate corresponding Parsons puzzles for each type
def generate_Parsons_block(
    personalize_level,
    language,
    Parsons_type,
    question_info,
    fixed_code,
    unchanged_lines,
    fixed_lines,
    distractors,
):
    """
    This is the main API to generate Parsons blocks based on the type of Parsons puzzles.
    Inputs:
        personalize_level (str): The level of personalization ("Multiple" or "Solution").
        language (str): The programming language of the code ("python" or "java").
        Parsons_type (str): The type of Parsons puzzles ("Full" or "Partial").
        question_info (str): The problem description or question information.
        fixed_code (str): The fixed code.
        unchanged_lines (list): List of tuples representing unchanged lines in the format (line number, code length, code).
        fixed_lines (list): List of tuples representing fixed lines in the format (line number, code length, code).
        distractors (dict): A dictionary where keys are fixed line tuples (line number, code length, code) and values are distractor lines (str).
    Output: Parsons_puzzle (str): The generated Parsons puzzle in string format.
    """
    if Parsons_type == "Full":
        return generate_full_Parsons(
            personalize_level, language, fixed_code, question_info
        )
    else:
        return generate_partial_Parsons(
            personalize_level,
            language,
            Parsons_type,
            question_info,
            unchanged_lines,
            fixed_lines,
            distractors,
        )


def break_and_indent(text, max_line_length, indent=4):
    """Break text into lines of a specified maximum length and indent them."""
    lines = []
    current_line = ""

    words = text.split()

    for word in words:
        if len(current_line) + len(word) + 1 > max_line_length:
            lines.append(" " * indent + current_line)
            current_line = word
        else:
            if current_line:
                current_line += " " + word
            else:
                current_line = word

    if current_line:
        lines.append(" " * indent + current_line)

    return "\n".join(lines)


def split_java_code_into_blocks(java_code):
    """
    Rule-based criteria to split Java code into Parsons blocks.
    Aim to not make empty {} into individual blocks.
    """
    lines = java_code.split("\n")
    blocks = []
    i = 0
    n = len(lines)

    def get_indent(line):
        return len(re.match(r"^(\s*)", line).group(1))

    def is_real_code(line):
        s = line.strip()
        return s and s not in ["{", "}"]

    def is_open_brace(line):
        return line.strip() == "{"

    def is_close_brace(line):
        return line.strip() == "}"

    while i < n:
        # Skip empty lines
        while i < n and not lines[i].strip():
            i += 1
        if i >= n:
            break

        block_lines = []
        base_indent = get_indent(lines[i])

        # Add first line to block
        block_lines.append(lines[i])
        i += 1

        # If next line is `{`, add it to this block
        if i < n and is_open_brace(lines[i]):
            block_lines.append(lines[i])
            i += 1

        # Add all real code lines with same indentation
        while i < n and get_indent(lines[i]) == base_indent and is_real_code(lines[i]):
            block_lines.append(lines[i])
            i += 1

        # If next line is `}`, add it to the last real code block
        if i < n and is_close_brace(lines[i]):
            block_lines.append(lines[i])
            i += 1

        blocks.append("\n".join(block_lines))

    Parsons_puzzle = convert_code_to_block(blocks)
    return Parsons_puzzle


def generate_full_Parsons(personalize_level, language, fixed_code, question_info):
    """
    Generate a fully movable Parsons puzzle without any distractors. - happens when the total similarity is too low (< 0.2)
    Inputs:
        personalize_level (str): The level of personalization ("Multiple" or "Solution").
        language (str): The programming language of the code ("python" or "java").
        fixed_code (str): The fixed code.
        question_info (str): The problem description or question information.
    Output: Parsons_puzzle (str): The generated Parsons puzzle in string format.
    """
    fixed_code = re.sub(r"\n\s*\n", "\n", fixed_code)
    question_info = break_and_indent(question_info, max_line_length=80)

    if language == "python":
        # Extract code blocks based on indentation patterns
        matches = re.findall(r"(?<=\n)(\s*)(.*)", fixed_code)
        matches = [("", fixed_code.split("\n")[0])] + matches
        # if no indentation, add to matches as ("", code_line)
        # Remove empty and whitespace-only blocks and add four indentation spaces to each block
        blocks = ["    " + block[0] + block[1] for block in matches if block[1].strip()]
        blocks = handle_imports_and_splitting(blocks)
        blocks = aggregate_code_to_full_Parsons_block(blocks)
        Parsons_puzzle = convert_code_to_block(blocks)
        return Parsons_puzzle
    elif language == "java":
        # for java, we do not want to split empty {} to individual blocks, so we need to do preprocessing
        java_Parsons_puzzle = split_java_code_into_blocks(fixed_code)
        return java_Parsons_puzzle


def generate_partial_Parsons(
    personalize_level,
    language,
    Parsons_type,
    question_info,
    unchanged_lines,
    fixed_lines,
    distractor_tuple_dict,
):
    """
    Generate a Parsons puzzle with some unmovable blocks and distractors.
    Inputs:
        personalize_level (str): The level of personalization ("Multiple" or "Solution").
        language (str): The programming language of the code ("python" or "java") - does not affect the current implementation.
        Parsons_type (str): The type of Parsons puzzles ("Full" or "Partial").
        question_info (str): The problem description or question information.
        unchanged_lines (list): List of tuples representing unchanged lines in the format (line number, code length, code).
        fixed_lines (list): List of tuples representing fixed lines in the format (line number, code length, code).
        distractor_tuple_dict (dict): A dictionary where keys are fixed line tuples (line number, code length, code) and values are distractor lines (str).
    Output: Parsons_puzzle (str): The generated Parsons puzzle in string format.
    """
    fixed_lines = [
        (line[0], line[1], line[2].rstrip() + "\n")
        for line in fixed_lines
        if line[2].strip()
    ]
    matched_fixed_lines = []
    if Parsons_type == "Partial" and personalize_level == "Multiple":
        unchanged_lines = [
            (line[0], line[1], line[2].rstrip() + " #settled\n")
            for line in unchanged_lines
            if line[2].strip()
        ]
    # some unchanged lines might be moved to the distractor list
    if Parsons_type == "Partial" and personalize_level == "Solution":
        unchanged_lines = [
            (line[0], line[1], line[2].rstrip() + "\n")
            for line in unchanged_lines
            if line[2].strip()
        ]

    blocks = fixed_lines + unchanged_lines + matched_fixed_lines
    for fixed_line_key in distractor_tuple_dict.keys():
        blocks = [
            (
                (line[0], line[1], line[2].rstrip() + " #matched-fixed\n")
                if line[2].strip() == fixed_line_key[2].strip()
                else (line[0], line[1], line[2])
            )
            for line in blocks
        ]
        fixed_line_code = fixed_line_key[2]
        line_indentation = fixed_line_code[
            : len(fixed_line_code) - len(fixed_line_code.lstrip())
        ]
        if type(distractor_tuple_dict[fixed_line_key]) == tuple:
            distractor_tuple_dict[fixed_line_key] = (
                fixed_line_key[0] + 0.5,
                fixed_line_key[0],
                line_indentation
                + distractor_tuple_dict[fixed_line_key][2].strip()
                + " #paired",
            )
        elif type(distractor_tuple_dict[fixed_line_key]) == str:
            distractor_tuple_dict[fixed_line_key] = (
                fixed_line_key[0] + 0.5,
                fixed_line_key[0],
                line_indentation
                + distractor_tuple_dict[fixed_line_key].strip()
                + " #paired",
            )  # add both unchanged_lines and fixed_lines of the fixed solution to blocks
    # add distractors to blocks
    blocks = blocks + list(distractor_tuple_dict.values())
    # add the fourth value to each tuple in blocks
    # Iterate over the list and modify the tuples
    for i, tpl in enumerate(blocks):
        actual_code = tpl[2]
        indentation = check_indentation_level(
            actual_code
        )  # Modify the second value based on the length of the third value
        # Add four indentation spaces to each block
        blocks[i] = (tpl[0], tpl[1], indentation, "    " + actual_code)

    blocks = aggregate_code_to_Parsons_block_with_distractor(blocks)
    question_info = break_and_indent(question_info, max_line_length=80)
    Parsons_puzzle = convert_code_to_block(blocks)
    return Parsons_puzzle


def keep_last_hash_tag_lines(input_string, hash_tag):
    """
    Keep only the last occurrence of a specific hash tag in each line of the input string.
    """
    lines = input_string.split("\n")
    output_lines = []
    found_last_settled = False
    for line in reversed(lines):
        if (hash_tag in line) & (not found_last_settled):
            output_lines.append(line)
            found_last_settled = True
        elif (hash_tag in line) & (found_last_settled == True):
            line = line.replace(hash_tag, "")
            output_lines.append(line)
        else:
            output_lines.append(line)
    return "\n".join(reversed(output_lines))


def check_settled_tag(items):
    """
    Check if any code item in the list contains multiple '#settled' tag.
    If so, keep only the last occurrence of '#settled' in that item.
    """
    tag_pattern = re.compile(r"\s*#settled\b")
    processed = []
    for item in items:
        matches = list(tag_pattern.finditer(item))
        if not matches:
            processed.append(item)
            continue
        # keep only the last #settled
        last_match = matches[-1]
        new_item = ""
        last_end = 0
        for m in matches:
            if m is last_match:
                new_item += item[last_end : m.end()]
            else:
                # remove this occurrence
                new_item += item[last_end : m.start()]
            last_end = m.end()
        new_item += item[last_end:]  # rest of the string
        processed.append(new_item)
    return processed


def reset_distractor_flag(distractor_block):
    """
    Remove all '#paired' and '#settled' tags from the distractor block list.
    If there is any '#paired' tag, keep the last line with '#paired' tag and add it back.
    """
    distractor_block = list(filter(None, distractor_block))
    has_paired = False

    for i, item in enumerate(distractor_block):
        if "#paired" in item:
            distractor_block[i] = item.replace("#paired", "")
            has_paired = True
        else:
            distractor_block[i] = item.replace("#settled", "")

    if has_paired:
        distractor_block[-1] = (
            distractor_block[-1].replace("\n", "") + " #paired" + "\n"
        )

    return distractor_block


def extract_distractor_Parsons_block(distractor_block_stack):
    """
    Extract distractor Parsons blocks from the distractor block stack.
    If there is only one distractor, return two separate blocks: fixed_line_block and distractor_line_block.
    If there are multiple distractors, return the combined blocks with only the last distractor mark "#paired" kept.
    """
    count_distractor = sum(
        1 for block_tuple in distractor_block_stack if "#paired" in block_tuple[1]
    )

    if count_distractor == 1:
        # Create two separate lists based on the extracted neighbor tuples
        fixed_line_block = reset_distractor_flag(
            [tpl[1] for tpl in distractor_block_stack if "#paired" not in tpl[1]]
        )
        fixed_line_block = "\n".join([block.rstrip("\n") for block in fixed_line_block])
        distractor_line_block = reset_distractor_flag(
            [tpl[1] for tpl in distractor_block_stack if "#matched-fixed" not in tpl[1]]
        )
        distractor_line_block = "\n".join(
            [block.rstrip("\n") for block in distractor_line_block]
        )
        return fixed_line_block, distractor_line_block
    else:
        # only keep the last line that has "#paired", one is settled + all paired; one is settled + all match-fixed
        d_stack_remove_matched_lines = [
            tup for tup in distractor_block_stack if "#matched-fixed" not in tup[1]
        ]
        d_blocks = "".join(str(block[1]) for block in d_stack_remove_matched_lines)
        d_block_keep_last_distractor = keep_last_hash_tag_lines(d_blocks, "#paired")
        d_blocks_list = reset_distractor_flag(d_block_keep_last_distractor.split("\n"))
        distractor_line_block = "\n".join(
            [block.rstrip("\n") for block in d_blocks_list]
        )

        f_stack_remove_matched_lines = [
            tup for tup in distractor_block_stack if "#paired" not in tup[1]
        ]
        f_blocks = "".join(str(block[1]) for block in f_stack_remove_matched_lines)
        f_block_keep_last_distractor = keep_last_hash_tag_lines(
            f_blocks, "#matched-fixed"
        )
        f_blocks_list = reset_distractor_flag(f_block_keep_last_distractor.split("\n"))
        fixed_line_block = "\n".join([block.rstrip("\n") for block in f_blocks_list])

        return fixed_line_block, distractor_line_block


def same_indentation_code_to_Parsons_block(blocks):
    """
    Check if the third value is the same for all tuples except the first one
    If so, aggregate all code lines into a single Parsons block.
    """
    all_Parsons_blocks = {}
    for block in blocks:
        if not block[3].endswith("\n"):
            block += "\n"

        all_Parsons_blocks[block[0]] = str(block[3])

    return all_Parsons_blocks


def handle_imports_and_splitting(blocks):
    """
    For Python, we want to separate import statements as single blocks to split them from the rest of the code.
    """
    processed_blocks = []

    for block in blocks:
        block_stripped = block.strip()

        # Separate import statements into their own block
        if block_stripped.startswith("import") or block_stripped.startswith("from"):
            processed_blocks.append(block)
            continue

        processed_blocks.append(block)

    return processed_blocks


def aggregate_code_to_Parsons_block_with_distractor(blocks):
    """
    Aggregate the code into Parsons blocks, handling distractor blocks specially.
    """
    blocks = [
        (tup[0], tup[1], tup[2], tup[3] if tup[3].endswith("\n") else tup[3] + "\n")
        for tup in blocks
    ]
    # Sort the blocks by their starting line number and then indentation level
    blocks = sorted(blocks, key=lambda tpl: (tpl[0], tpl[1]))
    current_indent_in_block_stack = blocks[0][2]
    distractor_indent = ""
    all_Parsons_blocks = {}
    block_stack = []
    same_indentation_level = all(item[2] == blocks[1][2] for item in blocks[1:])
    # if all blocks have the same indentation level, then aggregate all code lines into a single Parsons block
    if same_indentation_level:
        all_Parsons_blocks = same_indentation_code_to_Parsons_block(blocks)
    else:
        for index, block in enumerate(blocks):
            this_indent = block[2]
            # check wehther the current stack will be marked as a distractor block stack
            if "#paired" in block[3]:
                distractor_indent = this_indent
            # store the current block into the block stack
            if this_indent == current_indent_in_block_stack:
                block_stack.append((index, block[3]))
            elif (distractor_indent == "") & (
                this_indent != current_indent_in_block_stack
            ):
                # use the first line number of the block as the line sequence number
                all_Parsons_blocks[block_stack[0][0]] = "".join(
                    str(block[1]) for block in block_stack
                )
                block_stack = [(index, block[3])]
                current_indent_in_block_stack = this_indent
            # distractor_indent != "" means that detected that this is an end of a distractor block stack  or a start of a distractor block stack -- how to distinguish?
            # this_indent != current_indent_in_block_stack means that we have finished building a block stack
            # so we have stored all the related lines in this distractor block stack
            # now we need to do some special processing for the distractor block stack
            elif (distractor_indent != "") & (
                this_indent != current_indent_in_block_stack
            ):
                # if this, then we have finished building a distractor block stack
                count_fixed = sum(
                    1 for block in block_stack if "#matched-fixed" in block[1]
                )
                if count_fixed == 0:
                    # then this is just a start of a distractor block stack, moved what we have stored in the block stack to the all_Parsons_blocks first
                    all_Parsons_blocks[block_stack[0][0]] = block_stack
                # then continue
                fixed_line_block, distractor_block = extract_distractor_Parsons_block(
                    block_stack
                )
                # the numbers 0.20 and 0.22 are used to ensure that the distractor block comes right after the fixed line block
                all_Parsons_blocks[block_stack[0][0] + 0.20] = fixed_line_block
                all_Parsons_blocks[block_stack[0][0] + 0.22] = distractor_block
                # prepare for the next loop
                distractor_indent = ""
                block_stack = [(index, block[3])]
                current_indent_in_block_stack = this_indent
                # if it is the last item, then no loop anymore, just store the last block stack

            if index == len(blocks) - 1:
                if distractor_indent == "":
                    # use the first line number of the block as the line sequence number
                    all_Parsons_blocks[block_stack[0][0]] = "".join(
                        str(block[1]) for block in block_stack
                    )
                elif distractor_indent != "":
                    count_fixed = sum(
                        1 for block in block_stack if "#matched-fixed" in block[1]
                    )
                    if count_fixed == 0:
                        # then this is just a start of a distractor block stack, moved what we have stored in the block stack to the all_Parsons_blocks first
                        all_Parsons_blocks[block_stack[0][0]] = block_stack
                    # then continue
                    (
                        fixed_line_block,
                        distractor_block,
                    ) = extract_distractor_Parsons_block(block_stack)
                    all_Parsons_blocks[block_stack[0][0] + 0.20] = fixed_line_block
                    all_Parsons_blocks[block_stack[0][0] + 0.22] = distractor_block

    all_Parsons_blocks = OrderedDict(sorted(all_Parsons_blocks.items()))
    all_Parsons_blocks = list(all_Parsons_blocks.values())
    all_Parsons_blocks = [
        item.replace(" #matched-fixed", "") if "#matched-fixed" in item else item
        for item in all_Parsons_blocks
    ]
    # removing all occurrences of "#settled" lines except for the last one
    all_Parsons_blocks = check_settled_tag(all_Parsons_blocks)
    all_Parsons_blocks = [
        item for item in all_Parsons_blocks if item is not None and item != ""
    ]

    return all_Parsons_blocks


def aggregate_code_to_full_Parsons_block(blocks):
    """
    Aggregate the code into full Parsons blocks. All code lines with the same indentation level are grouped together.
    1. Function definitions (def) and return statements are treated as separate blocks.
    2. Import statements are grouped together into a single block.
    3. Other lines with the same indentation level are grouped together.
    4. If the indentation level changes, a new block is started.
    5. Blank lines are preserved within blocks.
    6. Each block ends with a newline character.
    """
    current_indent = check_indentation_level(blocks[0])
    all_Parsons_blocks = []
    Parsons_block = ""
    import_block = ""

    for block in blocks:
        if not block.endswith("\n"):
            block += "\n"

        this_indent = check_indentation_level(block)

        if block.strip().startswith("import"):
            import_block += block  # add to the import block
            continue  # continue processing without disrupting other logic

        if import_block and not block.strip().startswith("import"):
            all_Parsons_blocks.append(
                import_block
            )  # add the collected import block at the beginning
            import_block = ""  # reset the import block

        if block.strip().startswith(("def", "return")):
            if Parsons_block:  # append any current accumulated block
                all_Parsons_blocks.append(Parsons_block)
            Parsons_block = ""  # reset Parsons block
            all_Parsons_blocks.append(
                block
            )  # add the def or return statement as its own block
            current_indent = this_indent
        elif this_indent == current_indent:
            Parsons_block += block
        else:
            if Parsons_block:  # append current block before resetting
                all_Parsons_blocks.append(Parsons_block)
            Parsons_block = block
            current_indent = this_indent

    # add any remaining blocks
    if Parsons_block:
        all_Parsons_blocks.append(Parsons_block)

    return all_Parsons_blocks


def reduce_whitespace(text):
    """
    Reduce multiple spaces and tabs to a single space, preserving indentation and line breaks.
    """
    lines = text.split("\n")  # split the text into lines based on '\n'
    processed_lines = []
    if len(lines) == 1:
        indentation = text[: len(text) - len(text.lstrip())][:-1]
        rest_of_string = re.sub(r"\s+", " ", text.lstrip())
        return f"{indentation} {rest_of_string}"
    else:
        for line in lines:
            if line != "":
                indentation = text[: len(line) - len(line.lstrip())][:-1]
                rest_of_string = re.sub(r"\s+", " ", line.lstrip())
                processed_lines.append(f"{indentation} {rest_of_string}")
            # join the processed lines back using '\n'
        # determine the join character based on whether the line ends with '\n'
        join_char = "\n" if processed_lines[-1] != "" else ""

        # join the processed lines back using '\n' or '' as the join character
        processed_text = join_char.join(processed_lines)
        return processed_text


def convert_code_to_block(blocks):
    """
    Convert a list of code blocks into a single string with '---\n' as separators
    and ensure proper formatting.
    """
    for i, block in enumerate(blocks):
        block = reduce_whitespace(block)
        block = re.sub(r"\n+", "\n", block)
        # add -----\n at the beginning of the first block
        if not block.endswith("\n"):
            block += "\n"

        if i == 0:
            blocks[0] = block + "---\n"

        elif i == len(blocks) - 1:
            blocks[i] = block
        # add ===== after each block and then \n
        elif (i != 0) & (i < len(blocks) - 1):
            blocks[i] = block + "---\n"

    # save the blocks into a string
    blocks = "".join(blocks)
    return blocks
