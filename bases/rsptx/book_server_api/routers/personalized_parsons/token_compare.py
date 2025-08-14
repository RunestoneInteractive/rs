import io
import tokenize
import sys
import difflib
import tokenize
import io

def normalize_indentation(code):
    lines = code.split('\n')
    normalized_lines = []
    for line in lines:
        # Remove comments (anything after #)
        line = line.split("#")[0].strip()
        if line:  # Ignore empty lines
            normalized_lines.append(line)
    return "\n".join(normalized_lines)

def tokenize_code(code):
    try:
        tokens = [token.string for token in tokenize.tokenize(io.BytesIO(normalize_indentation(code).encode('utf-8')).readline)]
        return tokens, "Token"
    except tokenize.TokenError as e:
        # Attempt to tokenize segments of the code based on whitespace
        try:
            tokens = code.split()
            return tokens, "Segment"
        except:
            tokens = code
            return tokens, "Code"

def following_tokenize_code(code, type):
    if type == "Token":
        tokens = [token.string for token in tokenize.tokenize(io.BytesIO(normalize_indentation(code).encode('utf-8')).readline)]
    elif type == "Segment":
        tokens = code.split()
    else:
        tokens = code
    return tokens

def code_similarity_score(code1, code2):
    # Tokenize code snippets using ASTTokens
        # Tokenize code snippets using the tokenize module
    try:
        tokens1, type1 = tokenize_code(code1)
        tokens2 = following_tokenize_code(code2, type1)
    except:
        tokens2, type2 = tokenize_code(code2)
        tokens1 = following_tokenize_code(code1, type2)

    # Calculate similarity ratio using Levenshtein
    # Sensitive to small changes, even a single-character edit affects the ratio significantly.
    # SequenceMatcher.ratio: Focuses on sequential matches, so it may produce higher similarity even if there are reordered substrings.
    # similarity_ratio = distance.levenshtein(str1, str2)

    # Create a SequenceMatcher object
    matcher = difflib.SequenceMatcher(None, tokens1, tokens2)

    similarity_ratio = matcher.ratio()

    return similarity_ratio

