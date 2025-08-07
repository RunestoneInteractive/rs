import re
import ast

python_patterns = [
    re.compile(r'\b(\w+)\s*=\s*\{.*?\}'),   # dict
    re.compile(r'\b(\w+)\s*=\s*\[.*?\]'),   # list
    re.compile(r'\b(\w+)\s*=\s*\d+'),       # =
    re.compile(r'\b(\w+)\s*=\s*(True|False)'),  # boolean
    re.compile(r'def\s+\w+\s*\(([^)]*)\)'), # function parameters
    re.compile(r'\bfor\s+(\w+)\s+in\s+range\b'), # loop variables (range)
    re.compile(r'\bfor\s+(\w+)\s+in\s+(\w+)'),  # loop variables (iterable)
    re.compile(r'\bwhile\s+(\w+)\b'),       # while loop condition
    re.compile(r'\b(\w+)\s*=\s*open\s*\('),  # file open
    re.compile(r'\b(\w+)\s*=\s*csv\.reader\s*\(\s*(\w+)\s*\)'),  # CSV reader (e.g., csv_file = csv.reader(inFile))
    re.compile(r'\b(\w+)\s*=\s*\1\.read\(\)'),  # Reading file content (e.g., content = inFile.read())
    re.compile(r'\b(\w+)\s*=\s*\1\.readlines\(\)'),
    re.compile(r'with\s+open\s*\(.*?\)\s+as\s+(\w+)'),  # `with open(...) as var:` 
]

java_patterns = [
    re.compile(r'String\s+(\w+)\s*=\s*\".*?\"'),  # String assignment
    re.compile(r'int\s+(\w+)\s*=\s*\d+'),       # int assignment
    re.compile(r'boolean\s+(\w+)\s*=\s*(true|false)'),  # boolean assignment
    re.compile(r'List<\w+>\s+(\w+)\s*=\s*new\s+ArrayList<\w+>\(\)'),  # List initialization
    re.compile(r'for\s*\(\s*int\s+(\w+)\s*=\s*0;\s*\w+\s*<\s*\w+\.size\(\);\s*\w+\+\+\s*\)'),  # for loop with index
    re.compile(r'for\s*\(\s*String\s+(\w+)\s*:\s*(\w+)\s*\)'),  # for-each loop
    re.compile(r'while\s*\(\s*(\w+)\s*\)'),  # while loop condition
]


def act_extract(language, code):
    variables = set()
    # First, try using AST for accuracy - only for Python
    if language == "python":
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            variables.add(target.id)
                elif isinstance(node, ast.For):
                    if isinstance(node.target, ast.Name):
                        variables.add(node.target.id)
                elif isinstance(node, ast.While):
                    if isinstance(node.test, ast.Name):
                        variables.add(node.test.id)
                elif isinstance(node, ast.FunctionDef):
                    for arg in node.args.args:
                        variables.add(arg.arg)
                elif isinstance(node, ast.With):  # Detect `with open(...) as var:`
                    for item in node.items:
                        if isinstance(item.optional_vars, ast.Name):
                            variables.add(item.optional_vars.id)
            return ', '.join(sorted(variables))
        # If AST parsing fails, fall back to regex
        except:
            return False
    return False
    
def extract_variables(language, code):
    """
    Extract variable names from a given code snippet using AST and regex.
    This function first attempts to parse the code using the Abstract Syntax Tree (AST) for accuracy.
    If a SyntaxError occurs, it falls back to using regex patterns to find variable assignments.
    Args:
        code (str): The code snippet from which to extract variable names.
    Returns:
        str: A comma-separated string of variable names found in the code.
    """
    variables = set()
    act_result = act_extract(language, code)
    if bool(act_result): # If AST parsing was successful
        return act_result
    else:
        # select patterns based on the language
        patterns = java_patterns if language == "java" else python_patterns

        # Apply all regex patterns
        for pattern in patterns:
            matches = pattern.findall(code)
            for match in matches:
                if isinstance(match, tuple):
                    variables.update(match) 
                else:
                    variables.add(match)

    return ', '.join(sorted(variables))