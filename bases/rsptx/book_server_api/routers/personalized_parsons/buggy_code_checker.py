def clean_python_code(code):
    lines = []
    for line in code.split('\n'):
        # Remove comments and whitespace
        line = line.split('#')[0].strip()
        # Skip empty lines and lines starting with 'def' or 'import'
        if line and not line.startswith(('def ', 'import ')):
            lines.append(line)
    return '\n'.join(lines)

def clean_java_code(code):
    lines = []
    for line in code.split('\n'):
        # Remove comments and whitespace
        line = line.split('//')[0].strip()
        # Skip empty lines and lines starting with 'def' or 'import'
        if line and not line.startswith(('public ', 'import ')):
            lines.append(line)
    return '\n'.join(lines)

def buggy_code_checker(language, buggy_code, default_start_code, default_test_code):
    if language == "java":
        cleaned_buggy = clean_java_code(buggy_code)
    else:
        cleaned_buggy = clean_python_code(buggy_code)

    # This is used to check if students contributed any code
    if cleaned_buggy == default_start_code or \
       cleaned_buggy == default_test_code or \
       cleaned_buggy == default_start_code + default_test_code or \
       len(cleaned_buggy) == 0:
        return False

    return True

