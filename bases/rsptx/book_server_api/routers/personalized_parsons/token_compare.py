import io
import tokenize
import difflib
import javalang


def normalize_indentation(code):
    """Normalize indentation by removing comments and empty lines."""
    lines = code.split("\n")
    normalized_lines = []
    for line in lines:
        # Remove comments (anything after #)
        line = line.split("#")[0].strip()
        if line:  # Ignore empty lines
            normalized_lines.append(line)
    return "\n".join(normalized_lines)


def tokenize_code(code, language):
    """Tokenize the code into meaningful components. Try using the tokenize module first, if it fails, fall back to splitting by whitespace."""
    if language == "python":
        try:
            tokens = [
                token.string
                for token in tokenize.tokenize(
                    io.BytesIO(normalize_indentation(code).encode("utf-8")).readline
                )
            ]
            return tokens, "Token"
        except tokenize.TokenError:
            return code.split(), "Segment"
        except Exception:
            return [code], "Code"
    elif language == "java":
        try:
            tokens = [t.value for t in javalang.tokenizer.tokenize(code)]
            return tokens, "Token"
        except javalang.tokenizer.LexerError:
            return code.split(), "Segment"
        except Exception:
            return [code], "Code"


def following_tokenize_code(code, type, language):
    """Tokenize the code based on the type provided."""
    if language == "python":
        if type == "Token":
            tokens = [
                token.string
                for token in tokenize.tokenize(
                    io.BytesIO(normalize_indentation(code).encode("utf-8")).readline
                )
            ]
        elif type == "Segment":
            tokens = code.split()
        else:
            tokens = code
        return tokens
    elif language == "java":
        if type == "Token":
            tokens = [t.value for t in javalang.tokenizer.tokenize(code)]
        elif type == "Segment":
            tokens = code.split()
        else:
            tokens = code
        return tokens


def code_similarity_score(code1, code2, language):
    """
    Calculate the similarity score between two code snippets using tokenization and SequenceMatcher (can be improved).
    1. Tokenize the first code snippet using the tokenize module. - returns tokens1 and the tokenization type
    2. Try to tokenize the second code snippet using the same method as the first snippet.
       If it fails, tokenize the first code snippet using the method used for the second snippet.
    Inputs:
        code1 (str): The first code snippet.
        code2 (str): The second code snippet.
    Output:
        similarity_ratio (float): The similarity ratio between the two code snippets (0 to 1).
    """

    try:
        tokens1, type1 = tokenize_code(code1, language)
        tokens2 = following_tokenize_code(code2, type1, language)
    except:
        tokens2, type2 = tokenize_code(code2, language)
        tokens1 = following_tokenize_code(code1, type2, language)

    # Levenshtein cons: sensitive to small changes, even a single-character edit affects the ratio significantly.
    # SequenceMatcher.ratio cons: Focuses on sequential matches, so it may produce higher similarity even if there are reordered substrings.
    # Choose SequenceMatcher for now, as it better captures the overall structure of the code. This can be improved later.
    # Create a SequenceMatcher object
    matcher = difflib.SequenceMatcher(None, tokens1, tokens2)

    similarity_ratio = matcher.ratio()

    return similarity_ratio
