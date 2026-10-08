"""
Subgoal labels in CodeTailor puzzles.

A subgoal label is a full-line comment naming the step that the code below it
carries out, e.g. ``# Count how often each word appears``. Instructors write
them into a question's backup Parsons puzzle, and students may write their own
in the editor. This module

- builds a labels-only Parsons puzzle from a backup puzzle, for students who
  ask for help before writing any code, and
- puts labels back into code and puzzles that CodeTailor built from
  comment-free code (the pipeline strips comments before testing and diffing).

Labels are anchored to the first code line that follows them, and matched by
that line's code with all whitespace removed, so they survive the
re-indentation and whitespace squeezing that block generation applies.
"""

import ast
import html
import re

# Parsons markup tags that ride on the end of a code line ("x = 1 #settled",
# "y = 2 #paired: why this is wrong"). They are markup, not labels.
_TAG_RE = re.compile(r"\s*#(?:settled|paired|distractor|matched-fixed|tag:).*$")
_DISTRACTOR_TAGS = ("#paired", "#distractor")


_PY_KEYWORD_START_RE = re.compile(
    r"(?:return|for|while|if|def|class|import|from|print|with|raise|del|"
    r"assert|global|nonlocal|yield|lambda|break|continue|pass)\b"
)
_PY_CLAUSE_RE = re.compile(r"(?:else|try|finally|(?:elif|except)\b.*)\s*:$")
_CODE_PUNCTUATION_RE = re.compile(r"[=()\[\]{}.+\-*/%<>]")


def _comment_prefix(language):
    return "//" if language == "java" else "#"


def _is_full_line_comment(line, language):
    stripped = line.strip()
    return (
        stripped.startswith(_comment_prefix(language))
        and _TAG_RE.match(stripped) is None
    )


def _looks_like_code(text, language):
    """
    Whether a comment's text is commented-out code (``total = 0``,
    ``for num in nums:``, ``return avg``, ``count: int``) rather than a
    description of a step. Any statement other than a bare expression is
    code; a bare expression is code only when it starts with a keyword or uses
    code punctuation, so plain words do not count even when they happen to
    parse ("Setup").
    """
    if language == "java":
        return bool(re.search(r"[;{}]$", text)) or text in ("else", "} else {")
    if _PY_CLAUSE_RE.fullmatch(text):
        return True
    for candidate in (text, text + "\n    pass"):
        try:
            tree = ast.parse(candidate)
            break
        except (SyntaxError, ValueError):
            continue
    else:
        return False
    if any(not isinstance(statement, ast.Expr) for statement in tree.body):
        return True
    return bool(_PY_KEYWORD_START_RE.match(text) or _CODE_PUNCTUATION_RE.search(text))


def is_label_line(line, language):
    """True for a full-line comment that describes a step: not a Parsons
    markup tag, and not commented-out code."""
    if not _is_full_line_comment(line, language):
        return False
    text = line.strip()[len(_comment_prefix(language)) :].strip()
    return bool(text) and not _looks_like_code(text, language)


def has_labels(code, language):
    return any(is_label_line(line, language) for line in code.splitlines())


def strip_comment_lines(code, language):
    """Drop full-line comments -- labels and commented-out code alike -- so
    none becomes a block, leaving code and inline comments untouched."""
    return "\n".join(
        line for line in code.splitlines() if not _is_full_line_comment(line, language)
    )


def label_texts(code, language):
    """The labels in ``code``, whitespace-normalized, for comparing label sets."""
    return {
        " ".join(line.split())
        for line in code.splitlines()
        if is_label_line(line, language)
    }


def _code_key(line, language):
    """A code line reduced to what survives CodeTailor's cleaning and block
    generation: tags and inline comments removed, then all whitespace."""
    line = _TAG_RE.sub("", line)
    line = line.split(_comment_prefix(language), 1)[0]
    return "".join(line.split())


def label_anchors(code, language, keep=None):
    """
    Pair each run of label lines with the code line that follows it.

    Returns a list of ``(labels, key)`` where ``labels`` are the stripped label
    lines and ``key`` is the ``_code_key`` of the next code line. Labels with no
    code after them have nothing to attach to and are dropped. When ``keep`` is
    given, only labels whose normalized text is in it are kept.
    """
    anchors, pending = [], []
    for line in code.splitlines():
        if is_label_line(line, language):
            label = line.strip()
            if keep is None or " ".join(label.split()) in keep:
                pending.append(label)
        elif _is_full_line_comment(line, language):
            continue  # commented-out code is not where a label belongs
        elif line.strip():
            if pending:
                anchors.append((pending, _code_key(line, language)))
                pending = []
    return anchors


def _split_blocks(markup):
    """Split ``---``-separated Parsons markup into blocks of lines."""
    blocks, current = [], []
    for line in markup.splitlines():
        if line.strip() == "---":
            blocks.append(current)
            current = []
        elif line.strip():
            current.append(line)
    blocks.append(current)
    return [block for block in blocks if block]


def _join_blocks(blocks):
    return "\n---\n".join("\n".join(block) for block in blocks) + "\n"


def _is_distractor_block(block):
    return any(tag in line for line in block for tag in _DISTRACTOR_TAGS)


def _indent_of(line):
    return line[: len(line) - len(line.lstrip())]


def _attach(blocks, anchors, language):
    """
    Insert each anchor's labels above its code line, searching forward from the
    previous match so repeated lines (two ``return`` statements) keep their
    order. Distractor blocks are never anchors. Every label that lands in a
    block is also copied into the paired distractor blocks that follow it --
    to the top for a label on the block's first line, otherwise above the
    distractor's matching line -- so the labels do not reveal which block of
    the pair is correct.
    """
    positions = [
        (b, i)
        for b, block in enumerate(blocks)
        if not _is_distractor_block(block)
        for i in range(len(block))
    ]
    insertions = []  # (block, line, labels, key)
    cursor = 0
    for labels, key in anchors:
        for p in range(cursor, len(positions)):
            b, i = positions[p]
            if _code_key(blocks[b][i], language) == key:
                insertions.append((b, i, labels, key))
                cursor = p + 1
                break

    blocks = [list(block) for block in blocks]
    # Last insertion first, so earlier line numbers stay valid
    for b, i, labels, key in reversed(insertions):
        nxt = b + 1
        while nxt < len(blocks) and any("#paired" in ln for ln in blocks[nxt]):
            _insert_labels(
                blocks[nxt], _paired_line(blocks[nxt], i, key, language), labels
            )
            nxt += 1
        _insert_labels(blocks[b], i, labels)
    return blocks


def _paired_line(block, i, key, language):
    """Where a label at line ``i`` of a correct block goes in its distractor."""
    if i == 0:
        return 0
    for j, line in enumerate(block):
        if _code_key(line, language) == key:
            return j
    return min(i, len(block))


def _insert_labels(block, i, labels):
    reference = block[i] if i < len(block) else block[-1]
    indent = _indent_of(reference)
    block[i:i] = [indent + label for label in labels]


def attach_labels_to_code(code, labeled_code, language, keep=None):
    """
    Put the labels from ``labeled_code`` into comment-free ``code``. CodeTailor
    drops blank lines before it strips comments, so each removed comment leaves
    a whitespace-only line behind; those are dropped too.
    """
    lines = [line for line in code.splitlines() if line.strip()]
    anchors = label_anchors(labeled_code, language, keep)
    if anchors:
        lines = _attach([lines], anchors, language)[0]
    return "\n".join(lines)


def attach_labels_to_puzzle(puzzle, labeled_code, language, keep=None):
    """Put the labels from ``labeled_code`` into ``---``-separated puzzle markup
    that was generated from the same code with its labels stripped."""
    anchors = label_anchors(labeled_code, language, keep)
    if not anchors:
        return puzzle
    return _join_blocks(_attach(_split_blocks(puzzle), anchors, language))


def build_label_puzzle(parsons_markup, language, header=None, settle_header=False):
    """
    Build a labels-only Parsons puzzle from a backup puzzle's raw markup.

    Every non-distractor block that contains labels becomes one block of just
    those labels, keeping the instructor's grouping and their relative
    indentation. Code lines and distractors are dropped. ``header`` -- the
    function's ``def`` line(s) from the starter code -- becomes the first
    block, with the labels indented one level under it; without a header the
    shallowest label sits at column 0. ``settle_header`` locks the header in
    place (``#settled``), as CodeTailor's settled-block puzzles do.

    Returns ``(solution, markup)`` -- the puzzle as plain text (for the copy
    button) and the puzzle markup, still HTML-escaped like the input -- or
    ``None`` when the puzzle has fewer than two labeled blocks, since one block
    is not a puzzle.
    """
    label_blocks = [
        [line.rstrip() for line in block if is_label_line(line, language)]
        for block in _split_blocks(parsons_markup)
        if not _is_distractor_block(block)
    ]
    label_blocks = [block for block in label_blocks if block]
    if len(label_blocks) < 2:
        return None

    blocks, base = [], ""
    if header:
        # the header comes from plain-text starter code; the labels are
        # already escaped markup
        blocks.append([html.escape(line.rstrip(), quote=False) for line in header])
        base = _indent_of(header[-1]) + "    "
    cut = min(len(_indent_of(line)) for block in label_blocks for line in block)
    blocks += [[base + line[cut:] for line in block] for block in label_blocks]
    solution = html.unescape("\n".join(line for b in blocks for line in b))
    if header and settle_header:
        blocks[0][-1] += " #settled"
    return solution, _join_blocks(blocks)
