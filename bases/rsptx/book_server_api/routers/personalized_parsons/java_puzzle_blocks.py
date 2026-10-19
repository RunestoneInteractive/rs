"""
Regroup CodeTailor's Java Parsons puzzles into larger, less ambiguous blocks.

CodeTailor builds most Java puzzles one line per block, so a puzzle is full of
identical ``{`` and ``}`` blocks and of statements whose order does not
matter (``this.name = name;`` / ``this.grade = grade;``), yet the line grader
accepts only one order. ``restructure_java_puzzle`` regroups a finished
puzzle so that:

* an opening brace is in the same block as the header it opens,
* each closing brace is its own block, labeled with what it closes
  (``} // end getPrice``, ``} // end if``, ``} // end class``), and
* consecutive statements at the same indentation share one block. A header
  (``public int getPrice()``, ``if (...)``) always starts a new block.

Paired distractors follow the block their correct lines end up in: the
distractor becomes a copy of that whole block with its own lines in place of
the correct ones.
"""

import re

_TAG_RE = re.compile(r"\s*#(paired|distractor)\s*$")
_CONTROL_RE = re.compile(r"(else\s+if|if|else|for|while|do|switch|try|catch|finally)\b")
_NAME_RE = re.compile(r"(\w+)\s*\(")
_CLASS_RE = re.compile(r"\bclass\s+(\w+)")


def _split_blocks(puzzle):
    blocks, current = [], []
    for line in puzzle.split("\n"):
        if line.strip() == "---":
            blocks.append(current)
            current = []
        else:
            current.append(line)
    blocks.append(current)
    return [
        [ln.rstrip() for ln in b if ln.strip()]
        for b in blocks
        if any(ln.strip() for ln in b)
    ]


def _tag(block):
    match = _TAG_RE.search(block[-1])
    if not match:
        return None, block
    return match.group(1), block[:-1] + [block[-1][: match.start()].rstrip()]


def _indent(line):
    return len(line) - len(line.lstrip())


def _opens(line):
    return line.strip().endswith("{")


def _closing_label(header, class_name):
    """What a closing brace closes, from the header of the block it ends."""
    text = header.strip()
    control = _CONTROL_RE.match(text.lstrip("} ").strip())
    if control:
        word = re.sub(r"\s+", " ", control.group(1))
        return "end if" if word == "else if" else f"end {word}"
    if _CLASS_RE.search(text):
        return "end class"
    name = _NAME_RE.search(text)
    if name:
        return (
            "end constructor" if name.group(1) == class_name else f"end {name.group(1)}"
        )
    return None


def _brace_labels(lines):
    """Map the index of each bare ``}`` line to its label."""
    class_match = next(
        (_CLASS_RE.search(ln) for ln in lines if _CLASS_RE.search(ln)), None
    )
    class_name = class_match.group(1) if class_match else None
    labels, stack, last_header = {}, [], None
    for i, line in enumerate(lines):
        text = line.strip()
        if text.startswith("}"):
            header = stack.pop() if stack else None
            if text == "}" and header:
                label = _closing_label(header, class_name)
                if label:
                    labels[i] = label
            if _opens(line):  # "} else {"
                stack.append(text)
        elif text == "{":
            stack.append(last_header or "")
        elif _opens(line):
            stack.append(text)
        if text not in ("{", "}"):
            last_header = text
    return labels


def restructure_java_puzzle(puzzle):
    """Regroup a ``---``-separated Java puzzle (see the module docstring).
    Puzzles with settled blocks are returned unchanged: their fixed lines
    cannot share a block with lines the student has to place."""
    if "#settled" in puzzle:
        return puzzle
    blocks = _split_blocks(puzzle)
    if not blocks:
        return puzzle

    # Units: a solution block that has a paired distractor stays whole, so
    # the distractor can stand in for it; any other block splits into lines.
    solution, distractors, unpaired = [], {}, []
    for block in blocks:
        tag, lines = _tag(block)
        if tag == "paired" and solution:
            distractors.setdefault(len(solution) - 1, []).append(lines)
        elif tag:
            unpaired.append(block)
        else:
            solution.append(lines)
    split_units = []
    for idx, lines in enumerate(solution):
        if idx in distractors:
            split_units.append((lines, idx))
        else:
            split_units.extend(([ln], None) for ln in lines)

    flat = [ln for lines, _ in split_units for ln in lines]
    labels = _brace_labels(flat)

    # Group the units: [{"lines": [...], "units": [(start, lines, idx)]}]
    groups, pos = [], 0
    for n, (lines, idx) in enumerate(split_units):
        first = lines[0].strip()
        next_first = (
            split_units[n + 1][0][0].strip() if n + 1 < len(split_units) else ""
        )
        is_header = _opens(lines[-1]) or next_first == "{"
        current = groups[-1] if groups else None
        if first == "{" and current is not None and current["kind"] == "header":
            current["units"].append((pos, lines, idx))
            current["kind"] = "opened"
        elif first.startswith("}"):
            text = lines[0]
            if len(lines) == 1 and pos in labels and "//" not in text:
                lines = [f"{text} // {labels[pos]}"]
            groups.append(
                {
                    "kind": "header" if _opens(lines[-1]) else "closed",
                    "units": [(pos, lines, idx)],
                }
            )
        elif is_header:
            groups.append(
                {
                    "kind": "opened" if _opens(lines[-1]) else "header",
                    "units": [(pos, lines, idx)],
                }
            )
        elif (
            current is not None
            and current["kind"] == "statement"
            and _indent(current["units"][-1][1][-1]) == _indent(lines[0])
        ):
            current["units"].append((pos, lines, idx))
        else:
            groups.append({"kind": "statement", "units": [(pos, lines, idx)]})
        pos += len(split_units[n][0])

    out = []
    for group in groups:
        correct = [ln for _, lines, _ in group["units"] for ln in lines]
        out.append(correct)
        for k, (_, _, idx) in enumerate(group["units"]):
            for wrong in distractors.get(idx, []) if idx is not None else []:
                swapped = [
                    ln
                    for j, (_, lines, _) in enumerate(group["units"])
                    for ln in (wrong if j == k else lines)
                ]
                swapped[-1] += " #paired"
                out.append(swapped)
    out.extend(unpaired)
    return "\n---\n".join("\n".join(block) for block in out) + "\n"
