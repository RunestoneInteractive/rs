def clean_python_code(code):
    """
    Cleans the given Python code by removing comments, empty lines,
    and lines that start with 'def' or 'import' - to figure out if the student has contributed any code.
    Input: code (str): The Python code to be cleaned.
    Output: cleaned_code (str): The cleaned Python code.
    """
    lines = []
    for line in code.split("\n"):
        # Remove comments and whitespace
        line = line.split("#")[0].strip()
        # Skip empty lines and lines starting with 'def' or 'import'
        if line and not line.startswith(("def ", "import ", "from ", "class ")):
            lines.append(line)
    return "\n".join(lines)


def clean_java_code(code):
    """
    Cleans the given Java code by removing comments, empty lines,
    and lines that start with 'public' or 'import' - to figure out if the student has contributed any code.
    Input: code (str): The Java code to be cleaned.
    Output: cleaned_code (str): The cleaned Java code.
    """
    lines = []
    for line in code.split("\n"):
        # Remove comments and whitespace
        line = line.split("//")[0].strip()
        # Skip empty lines and lines starting with 'def' or 'import'
        if line and not line.startswith(("public ", "import ")):
            lines.append(line)
    return "\n".join(lines)


def student_code_checker(language, buggy_code):
    """
    Check if the buggy code contains any student-contributed code.
    Input: language (str): The programming language of the code ('python' or 'java').
           buggy_code (str): The buggy code to be checked.
    Output: has_contributed_code (bool): True if the student has contributed code, False otherwise.
    """
    if language == "java":
        cleaned_buggy = clean_java_code(buggy_code)
    else:
        cleaned_buggy = clean_python_code(buggy_code)

    # This is used to check if students contributed any code
    if len(cleaned_buggy) == 0:
        return False

    return True
