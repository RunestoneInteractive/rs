# ******************************************************************
# |docname| - convert a question's HTML to its ``question_json``
# ******************************************************************
# The ``question_json`` column holds a question's type-specific content in the
# shape described in ``docs/source/question_json_schema.rst``. The assignment
# builder writes it for the questions it creates; this module derives it from
# the HTML of a book question, as found in the ``<htmlsrc>`` of a question in
# runestone-manifest.xml, or as stored in the ``htmlsrc`` column.
#
# Each converter turns the component element (the one carrying
# ``data-component``) into a dict, and records anything it could not represent
# as a *loss*. The builder regenerates a question's HTML from its
# ``question_json`` when the question is copied or edited, so a lossy
# ``question_json`` would quietly degrade the question; callers should only
# store a conversion that is ``lossless``.
#
# Things the converters deliberately ignore, because they are presentation
# defaults the builder supplies on its own (e.g. ``data-timelimit="25000"``),
# are listed in ``Conversion.ignored`` so they can be reviewed.
#
# Imports
# =======
import html
import json
import re
from dataclasses import dataclass, field
from typing import Callable, Optional

import lxml.etree as ET
import lxml.html


@dataclass
class Conversion:
    question_json: Optional[dict] = None
    # What the HTML holds that question_json can't represent
    losses: list = field(default_factory=list)
    # Attributes or markup dropped as presentation defaults
    ignored: list = field(default_factory=list)

    @property
    def lossless(self):
        return self.question_json is not None and not self.losses


class _Context:
    """Collects losses and the elements a converter consumed."""

    def __init__(self, el, htmlsrc):
        self.el = el
        self.htmlsrc = htmlsrc
        self.losses = []
        self.ignored = []
        # Elements outside the component that a converter used, e.g. the
        # exercise statement PreTeXt puts beside a multiple choice <ul>.
        self.consumed = set()

    def loss(self, reason):
        if reason not in self.losses:
            self.losses.append(reason)

    def ignore(self, reason):
        if reason not in self.ignored:
            self.ignored.append(reason)

    def check_attributes(self, el, handled, ignored=(), defaults=None, what=None):
        """Record a loss for each attribute of ``el`` no converter understands.

        ``handled`` attributes are converted, ``ignored`` ones are dropped as
        presentation, and ``defaults`` maps an attribute to the value the
        builder writes anyway: any other value is a loss.
        """
        what = what or el.tag
        defaults = defaults or {}
        for name, value in el.attrib.items():
            if name in handled:
                continue
            if name in ignored:
                self.ignore(f"{what}@{name}")
            elif name in defaults:
                if value == defaults[name]:
                    self.ignore(f"{what}@{name}={value}")
                else:
                    self.loss(f"{what}@{name}={value}")
            else:
                self.loss(f"{what}@{name}")


# Attributes on a component element that carry no question content.
_COMMON_ATTRIBUTES = {"data-component", "id", "class", "style", "data-question_label"}


# Helpers
# =======
def _escaped(text):
    """Text from lxml (``.text`` or ``.tail``) as markup.

    lxml returns text with entities decoded, while ``ET.tostring`` escapes
    the text it serializes; this escapes text the same way so it can be
    joined with serialized elements.
    """
    return html.escape(text or "", quote=False)


def inner_html(el):
    """The markup inside ``el``, without the element's own tags."""
    if el is None:
        return ""
    inner = _escaped(el.text) + "".join(
        ET.tostring(child, encoding="unicode", with_tail=True) for child in el
    )
    return inner.strip()


def _outer_html(el, with_tail=False):
    return ET.tostring(el, encoding="unicode", with_tail=with_tail)


def _has_class(el, name):
    return name in (el.get("class") or "").split()


def _child_with_class(el, name):
    for child in el:
        if _has_class(child, name):
            return child
    return None


def _check_outside_content(cx):
    """Note content in ``<htmlsrc>`` around the component.

    PreTeXt puts an exercise's hints and solutions, an introduction or a
    conclusion beside the interactive. They belong to the book rather than
    the question, so they are ignored rather than counted as a loss.
    """
    if cx.htmlsrc is None:
        return
    node = cx.el
    while node is not None and node is not cx.htmlsrc:
        parent = node.getparent()
        if parent is None:
            break
        if (parent.text or "").strip():
            cx.ignore("content outside the component")
        for sibling in parent:
            if sibling is node:
                if (sibling.tail or "").strip():
                    cx.ignore("content outside the component")
                continue
            if sibling in cx.consumed:
                continue
            if isinstance(sibling.tag, str) or (sibling.tail or "").strip():
                classes = (
                    sibling.get("class", "") if isinstance(sibling.tag, str) else ""
                )
                label = (
                    f"<{sibling.tag} class='{classes}'>"
                    if classes
                    else f"<{sibling.tag}>"
                )
                cx.ignore(f"content outside the component: {label}")
        node = parent


# Converters
# ==========
# Each takes a _Context and returns the question_json dict.


def _mchoice(cx):
    el = cx.el
    cx.check_attributes(
        el,
        _COMMON_ATTRIBUTES | {"data-multipleanswers", "data-random"},
        what="multiplechoice",
    )
    # The statement is either the markup before the first <li> of the <ul>,
    # or (newer PreTeXt) a sibling div.exercise-statement before the <ul>.
    statement = _escaped(el.text).strip()
    for child in el:
        if child.tag == "li":
            break
        statement += _outer_html(child, with_tail=True)
    statement = statement.strip()
    if not statement:
        for sibling in el.itersiblings(preceding=True):
            if isinstance(sibling.tag, str) and _has_class(
                sibling, "exercise-statement"
            ):
                statement = inner_html(sibling)
                cx.consumed.add(sibling)
                break
    options = []
    for li in el.iterchildren("li"):
        kind = li.get("data-component")
        if kind == "answer":
            option = {"choice": inner_html(li), "feedback": "", "correct": False}
            option["correct"] = "data-correct" in li.attrib
            options.append(option)
        elif kind == "feedback" and options:
            options[-1]["feedback"] = inner_html(li)
        else:
            cx.loss(f"multiplechoice <li data-component='{kind}'>")
    multiple = el.get("data-multipleanswers") == "true"
    correct = sum(o["correct"] for o in options)
    return {
        "statement": statement,
        "optionList": options,
        # The builder writes data-multipleanswers when there is more than one
        # correct answer or when this is set.
        "forceCheckboxes": multiple and correct <= 1,
        # as mchoice.js reads it, with parseBooleanAttribute
        "random": el.get("data-random", "false").lower() not in ("false", "no"),
    }


def _shortanswer(cx):
    el = cx.el
    cx.check_attributes(
        el, _COMMON_ATTRIBUTES | {"data-attachment"}, ignored={"data-mathjax"}
    )
    return {"statement": inner_html(el), "attachment": "data-attachment" in el.attrib}


# The markers activecode.js splits a textarea's code on, in the order it
# looks for them:
#
#   prefix ^^^^ visible prefix ^^^! starter ===! visible suffix ==== suffix
#   ===iotests=== [{"input": ..., "out": ...}, ...]
_IOTESTS_MARKER = "===iotests==="
_PREFIX_MARKER = re.compile(r"\^\^\^\^+\n?")
_VISIBLE_PREFIX_MARKER = re.compile(r"\^\^\^!\n?")
_SUFFIX_MARKER = re.compile(r"====+\n?")
_VISIBLE_SUFFIX_MARKER = re.compile(r"===!\n?")

# question_json key -> (textarea attribute, kind). A boolean is written as
# ="yes"; "comma" and "space" are lists of question ids.
ACTIVECODE_OPTIONS = {
    "timeLimit": ("data-timelimit", "number"),
    "compileArgs": ("data-compileargs", "string"),
    "linkArgs": ("data-linkargs", "string"),
    "runArgs": ("data-runargs", "string"),
    "interpreterArgs": ("data-interpreterargs", "string"),
    "addFiles": ("data-add-files", "comma"),
    "compileAlso": ("data-compile-also", "string"),
    "sourceFile": ("data-sourcefile", "string"),
    "highlightLines": ("data-highlight-lines", "string"),
    "includes": ("data-include", "space"),
    "dbUrl": ("data-dburl", "string"),
    "autoRun": ("data-autorun", "bool"),
    "hideCode": ("data-hidecode", "bool"),
    "hideHistory": ("data-hidehistory", "bool"),
    "enableDownload": ("data-enabledownload", "bool"),
    "gradeButton": ("data-gradebutton", "bool"),
    "noPair": ("data-nopair", "bool"),
    "showLastSql": ("data-showlastsql", "bool"),
    "chatCodes": ("data-chatcodes", "bool"),
    "tie": ("data-tie", "string"),
    "caption": ("data-caption", "string"),
}
_DEFAULT_TIMELIMIT = "25000"


def _split_marker(code, marker):
    """Split ``code`` at the first match of ``marker``: (before, after)."""
    match = marker.search(code)
    if not match:
        return None, code
    return code[: match.start()], code[match.end() :]


def _activecode_option(cx, value, kind):
    if kind == "number":
        try:
            return int(value)
        except ValueError:
            cx.loss(f"activecode option that is not a number: {value}")
            return None
    if kind == "bool":
        # as parseBooleanAttribute reads it
        return value.lower() not in ("false", "no")
    if kind == "comma":
        return [v.strip() for v in value.split(",") if v.strip()]
    if kind == "space":
        return value.split()
    return value


def _check_textarea_attributes(cx, textarea, handled=()):
    """Check the attributes of an activecode <textarea>."""
    options = {attribute for attribute, _ in ACTIVECODE_OPTIONS.values()}
    cx.check_attributes(
        textarea,
        {
            "id",
            "style",
            "data-question_label",
            "data-lang",
            "data-datafile",
            "data-codelens",
        }
        | options
        | set(handled),
        # data-coach is no longer read by activecode.js
        ignored={"data-coach"},
        defaults={"data-audio": "", "data-wasm": "/_static"},
    )


def _datafiles(textarea):
    datafiles = (textarea.get("data-datafile") or "").split(",")
    return [f.strip() for f in datafiles if f.strip()]


def _activecode_options(cx, textarea):
    """The ACTIVECODE_OPTIONS set on an activecode <textarea>."""
    result = {}
    for key, (attribute, kind) in ACTIVECODE_OPTIONS.items():
        value = textarea.get(attribute)
        if value is None:
            continue
        if attribute == "data-timelimit" and value == _DEFAULT_TIMELIMIT:
            cx.ignore(f"textarea@{attribute}={value}")
            continue
        value = _activecode_option(cx, value, kind)
        if value is not None:
            result[key] = value
    return result


def _activecode(cx):
    el = cx.el
    cx.check_attributes(el, _COMMON_ATTRIBUTES | {"data-filename"}, what="activecode")
    textarea = el.find(".//textarea")
    if textarea is None:
        cx.loss("activecode without a textarea")
        return None
    question = None
    for child in el:
        if child is textarea:
            continue
        if _has_class(child, "ac_question"):
            question = child
        else:
            cx.loss(f"activecode child <{child.tag}>")
    _check_textarea_attributes(
        cx,
        textarea,
        {
            "data-stdin",
            "data-parsonspersonalize",
            "data-parsonsexample",
            "data-parsons-personalized",
        },
    )
    # A browser drops a newline right after <textarea>.
    code = (textarea.text or "").removeprefix("\n")
    iotests = None
    if _IOTESTS_MARKER in code:
        code, _, tests = code.partition(_IOTESTS_MARKER)
        try:
            iotests = json.loads(tests)
        except ValueError:
            cx.loss("activecode io tests that are not JSON")
    # The builder writes a newline before each marker, so it belongs to the
    # marker rather than the code before it.
    prefix, code = _split_marker(code, _PREFIX_MARKER)
    visible_prefix, code = _split_marker(code, _VISIBLE_PREFIX_MARKER)
    starter, suffix = code, None
    match = _SUFFIX_MARKER.search(code)
    if match:
        starter, suffix = code[: match.start()], code[match.end() :]
    visible_suffix = None
    match = _VISIBLE_SUFFIX_MARKER.search(starter)
    if match:
        starter, visible_suffix = starter[: match.start()], starter[match.end() :]
    personalize = textarea.get("data-parsonspersonalize") or ""
    result = {
        "instructions": inner_html(question),
        "language": textarea.get("data-lang", ""),
        "prefix_code": (prefix or "").removesuffix("\n"),
        "starter_code": starter.removesuffix("\n"),
        "suffix_code": suffix or "",
        "stdin": textarea.get("data-stdin", ""),
        "selectedExistingDataFiles": _datafiles(textarea),
        "enableCodeTailor": bool(personalize),
        "parsonspersonalize": personalize,
        "parsonsexample": textarea.get("data-parsonsexample", ""),
        "parsonsPersonalized": textarea.get("data-parsons-personalized") != "false",
        "enableCodelens": textarea.get("data-codelens") == "true",
    }
    if visible_prefix is not None:
        result["visible_prefix_code"] = visible_prefix.removesuffix("\n")
    if visible_suffix is not None:
        result["visible_suffix_code"] = visible_suffix.removesuffix("\n")
    if iotests is not None:
        result["iotests"] = iotests
    if el.get("data-filename"):
        result["filename"] = el.get("data-filename")
    result.update(_activecode_options(cx, textarea))
    return result


def _lead(line):
    return len(line) - len(line.lstrip(" "))


def _parsons_blocks(cx, text):
    """Split the text of a parsons <pre> into ParsonsBlocks.

    Mirrors parsons.js: blocks are separated by ``---`` (or, with none, each
    line is a block), and a block may end with ``#distractor``, ``#paired``
    (each with an optional ``: explanation``) or ``#tag:t; depends:a,b;``.

    parsons.js grades indentation by ranking the distinct indents of every
    line. The builder writes a block's ``indent`` as 4 spaces per level in
    front of each of its lines, so each line is re-indented to 4 spaces per
    rank: a block's ``indent`` is the rank of its least indented line (in
    Java a block often ends with a ``}`` left of its first line), and each
    line keeps its rank relative to that. Every line keeps its rank.
    """
    text = text.strip()
    pieces = text.split("---") if "---" in text else text.split("\n")
    raw = []
    for index, piece in enumerate(pieces):
        # Like parsons.js, take the option off the block before reading its
        # lines, so a marker on a line of its own isn't an indentation.
        options = {}
        marker = re.search(r"#(paired|distractor)(?::(.*))?$", piece, re.S)
        tag = re.search(r"#tag:\s*([^;]*);\s*depends:\s*([^;]*);\s*$", piece)
        if "#settled" in piece:
            cx.loss("parsons #settled block")
        if marker:
            piece = piece[: marker.start()]
            options["isDistractor"] = True
            if marker.group(1) == "paired":
                options["isPaired"] = True
                options["pairedWithBlockAbove"] = True
            if (marker.group(2) or "").strip():
                options["explanation"] = marker.group(2).strip()
        elif tag:
            piece = piece[: tag.start()]
            # parsons.js names a block with an empty tag after its position
            options["tag"] = tag.group(1).strip() or f"block-{index}"
            depends = tag.group(2).replace(" ", "")
            options["depends"] = depends.split(",") if depends else []
        lines = [line.rstrip() for line in piece.split("\n") if line.strip()]
        if lines:
            raw.append((lines, options))
    ranks = sorted({_lead(line) for lines, _ in raw for line in lines})
    blocks = []
    for lines, options in raw:
        if any("\t" in line[: len(line) - len(line.lstrip())] for line in lines):
            cx.loss("parsons indentation with tabs")
        rank = min(ranks.index(_lead(line)) for line in lines)
        content = "\n".join(
            " " * ((ranks.index(_lead(line)) - rank) * 4) + line.lstrip(" ")
            for line in lines
        )
        block = {"id": f"block-{len(blocks) + 1}", "content": content, "indent": rank}
        block.update(options)
        blocks.append(block)
    return blocks


def _parsonsprob(cx):
    el = cx.el
    cx.check_attributes(el, _COMMON_ATTRIBUTES, what="parsons")
    pre = None
    question = None
    for child in el:
        if _has_class(child, "parsonsblocks"):
            pre = child
        elif _has_class(child, "parsons_question"):
            question = child
        else:
            cx.loss(f"parsons child <{child.tag}>")
    if pre is None:
        cx.loss("parsons without blocks")
        return None
    cx.check_attributes(
        pre,
        {
            "id",
            "class",
            "style",
            "data-question_label",
            "data-language",
            "data-adaptive",
            "data-numbered",
            "data-noindent",
            "data-grader",
            "data-order",
            "data-runnable",
        },
        what="parsonsblocks",
    )
    result = {
        "instructions": inner_html(question),
        "language": pre.get("data-language", ""),
        "blocks": _parsons_blocks(cx, inner_html(pre)),
        "adaptive": pre.get("data-adaptive") == "true",
        "numbered": pre.get("data-numbered") or "none",
        "noindent": pre.get("data-noindent") == "true",
        "grader": "dag" if pre.get("data-grader") == "dag" else "line",
        "orderMode": "random",
    }
    if pre.get("data-order"):
        order = [int(n) for n in pre.get("data-order").split(",")]
        result["orderMode"] = "custom"
        result["customOrder"] = order
        # With orderMode "custom" the builder orders blocks by displayOrder
        for position, index in enumerate(order):
            if 0 <= index < len(result["blocks"]):
                result["blocks"][index]["displayOrder"] = position
            else:
                cx.loss(f"parsons data-order names a missing block {index}")
    if pre.get("data-runnable", "false").lower() not in ("false", "no"):
        result.update(_parsons_runnable(cx))
    return result


# Where the student's solved program goes in a runnable parsons program
PARSONS_CODE_MARKER = "==PARSONSCODE=="


def _parsons_runnable(cx):
    """The program a solved runnable parsons runs.

    It is a hidden activecode in a sibling ``<div id="{id}-runnable">``;
    parsons.js puts the student's code where ``==PARSONSCODE==`` is and
    renders it once the puzzle is solved.
    """
    runnable_id = f"{cx.el.get('id')}-runnable"
    holder = next((s for s in cx.el.itersiblings() if s.get("id") == runnable_id), None)
    if holder is None:
        cx.loss("runnable parsons without its program")
        return {"runnable": True}
    cx.consumed.add(holder)
    cx.check_attributes(holder, {"id", "style"}, what="parsons-runnable holder")
    activecode = holder.find("./*[@data-component='parsons-runnable']")
    textarea = activecode.find("./textarea") if activecode is not None else None
    if textarea is None or len(holder) != 1 or len(activecode) != 1:
        cx.loss("parsons runnable program is not a single activecode")
        return {"runnable": True}
    cx.check_attributes(activecode, {"data-component", "id"}, what="parsons-runnable")
    _check_textarea_attributes(cx, textarea)
    options = {
        "language": textarea.get("data-lang", ""),
        "selectedExistingDataFiles": _datafiles(textarea),
        "enableCodelens": textarea.get("data-codelens") == "true",
    }
    options.update(_activecode_options(cx, textarea))
    code = (textarea.text or "").removeprefix("\n")
    if PARSONS_CODE_MARKER not in code:
        cx.loss("parsons runnable program without ==PARSONSCODE==")
    return {"runnable": True, "runnableCode": code, "runnableOptions": options}


# How the builder writes the rule for an exact string (its "string" grader)
# and the catch-all rule PreTeXt and the builder put last in every blank.
_EXACT_REGEX = re.compile(r"^\^\\s\*(.*)\\s\*\$$", re.S)
_CATCH_ALL = "^\\s*.*\\s*$"
_REGEX_SPECIALS = set(".^$*+?{}[]\\|()")


def _fitb_blank(cx, index, rules):
    """Convert one blank's feedback rules to a BlankWithFeedback.

    The first rule is the correct answer (fitb-utils.js grades only a match
    on rule 0 as correct) and the last should be a catch-all. Any rule in
    between gives feedback on a specific wrong answer, which the schema
    can't hold.
    """
    blank = {"id": f"blank-{index + 1}"}
    if len(rules) < 2:
        cx.loss("fill-in blank with a single rule (always graded incorrect)")
        return blank
    if len(rules) > 2:
        cx.loss("fill-in blank with feedback for specific wrong answers")
    first, last = rules[0], rules[-1]
    if "regex" in last and last["regex"] != _CATCH_ALL:
        cx.loss("fill-in blank without a catch-all rule")
    if any("solution_code" in rule for rule in rules):
        cx.loss("fill-in rule checked by code (solution_code)")
    if "number" in first:
        bounds = first["number"]
        if len(bounds) != 2 or not all(isinstance(b, (int, float)) for b in bounds):
            cx.loss("fill-in number rule that is not [min, max]")
            return blank
        blank.update(
            graderType="number", numberMin=str(bounds[0]), numberMax=str(bounds[1])
        )
    elif "regex" in first:
        match = _EXACT_REGEX.match(first["regex"])
        pattern = match.group(1) if match else first["regex"]
        flags = first.get("regexFlags", "")
        if not pattern.strip():
            cx.loss("fill-in correct answer pattern is empty")
        if match and not flags and not _REGEX_SPECIALS & set(pattern):
            blank.update(graderType="string", exactMatch=pattern)
        else:
            blank.update(graderType="regex", regexPattern=pattern, regexFlags=flags)
            if not match:
                # The builder wraps a pattern in ^\s*...\s*$
                cx.loss("fill-in regex not anchored as ^\\s*...\\s*$")
    elif "solution_code" not in first:
        cx.loss("fill-in rule with neither regex nor number")
    blank["correctFeedback"] = (first.get("feedback") or "").strip()
    blank["incorrectFeedback"] = (last.get("feedback") or "").strip()
    return blank


def _replace_blanks(html):
    return re.sub(r"<input\b[^>]*/?>(</input>)?", "{blank}", html)


def _fillintheblank(cx):
    el = cx.el
    cx.check_attributes(el, _COMMON_ATTRIBUTES, what="fillintheblank")
    script = el.find("./script")
    if script is None:
        cx.loss("fill-in without its JSON script")
        return None
    try:
        data = json.loads(script.text or "")
    except ValueError:
        cx.loss("fill-in JSON does not parse")
        return None
    if isinstance(data, dict):
        # Newer PreTeXt (and the builder): the problem is inside the JSON.
        for key in ("dyn_vars", "dyn_imports"):
            if data.get(key):
                cx.loss("fill-in with dynamic variables")
        if (data.get("solutionHtml") or "").strip():
            cx.loss("fill-in solutionHtml")
        problem = data.get("problemHtml", "")
        feedback = data.get("feedbackArray", [])
        for child in el:
            if child is not script:
                cx.loss(f"fill-in child <{child.tag}> beside the JSON")
    else:
        # Older PreTeXt: the problem is the markup around the JSON script.
        problem = _escaped(el.text) + "".join(
            _outer_html(child, with_tail=True) for child in el if child is not script
        )
        feedback = data
    if re.search(r"<input\b[^>]*\b(size|placeholder)=", problem):
        cx.ignore("fill-in <input> size/placeholder")
    question_text = _replace_blanks(problem.strip())
    blanks = [_fitb_blank(cx, i, rules) for i, rules in enumerate(feedback)]
    if question_text.count("{blank}") != len(blanks):
        cx.loss("fill-in blank count differs from its feedback")
    return {"questionText": question_text, "blanks": blanks}


def _dragndrop_from_xml(root):
    """A ``<dragndrop>`` written as XML (PreTeXt cardsort with card feedback)."""

    def items(tag):
        result = []
        for card in root.findall(f"./{tag}"):
            item = {
                "id": (card.findtext("./id") or "").strip(),
                "label": inner_html(card.find("./label")),
            }
            feedback = inner_html(card.find("./feedback"))
            if feedback:
                item["feedback"] = feedback
            result.append(item)
        return result

    return {
        "statement": inner_html(root.find("./statement")),
        "feedback": inner_html(root.find("./feedback")),
        "left": items("premise"),
        "right": items("response"),
        "correctAnswers": [
            [answer.get("premise", ""), answer.get("response", "")]
            for answer in root.findall("./answer")
        ],
    }


def _dragndrop_from_markup(cx):
    """The data-subcomponent markup, read as dragndrop.js populateFromHtml does."""
    el = cx.el

    def category(item):
        return item.get("data-category") or item.get("for") or item.get("id")

    left, right, answers = [], [], []
    statement = feedback = ""
    for item in el.iter():
        kind = item.get("data-subcomponent")
        if kind == "draggable":
            left.append({"id": item.get("id", ""), "label": inner_html(item)})
        elif kind == "dropzone":
            right.append(
                {
                    "id": (item.get("for") or "").replace("drag", "drop"),
                    "label": inner_html(item),
                    "category": category(item),
                }
            )
        elif kind == "question":
            statement = inner_html(item)
        elif kind == "feedback":
            feedback = inner_html(item)
        elif kind:
            cx.loss(f"dragndrop data-subcomponent='{kind}'")
    premise_category = {
        item.get("id"): category(item)
        for item in el.iter()
        if item.get("data-subcomponent") == "draggable"
    }
    for premise in left:
        for response in right:
            if premise_category[premise["id"]] == response["category"]:
                answers.append([premise["id"], response["id"]])
    for response in right:
        del response["category"]
    return {
        "statement": statement,
        "feedback": feedback,
        "left": left,
        "right": right,
        "correctAnswers": answers,
    }


def _dragndrop(cx):
    el = cx.el
    cx.check_attributes(el, _COMMON_ATTRIBUTES, what="dragndrop")
    if el.get("data-random") == "no":
        cx.loss("dragndrop data-random='no' (fixed card order)")
    root = el.find("./script[@type='text/xml']/dragndrop")
    if root is not None:
        return _dragndrop_from_xml(root)
    script = el.find("./script[@type='application/json']")
    if script is not None:
        # As the builder writes a question whose cards have feedback
        return json.loads(script.text or "{}")
    return _dragndrop_from_markup(cx)


def _matching(cx):
    el = cx.el
    cx.check_attributes(el, _COMMON_ATTRIBUTES, what="matching")
    script = el.find("./script")
    if script is None:
        cx.loss("matching without its script")
        return None
    if script.get("type") == "application/json":
        return json.loads(script.text or "{}")
    root = script.find("./matching")
    if root is None:
        cx.loss("matching script without <matching>")
        return None

    def items(tag):
        return [
            {
                "id": (card.findtext("./id") or "").strip(),
                "label": inner_html(card.find("./label")),
            }
            for card in root.findall(f"./{tag}")
        ]

    return {
        "statement": inner_html(root.find("./statement")),
        "feedback": inner_html(root.find("./feedback")),
        "left": items("premise"),
        "right": items("response"),
        "correctAnswers": [
            [(label.text or "").strip() for label in edge.findall("./label")[:2]]
            for edge in root.findall("./edge")
        ],
    }


def _clickablearea(cx):
    el = cx.el
    cx.check_attributes(el, _COMMON_ATTRIBUTES, what="clickablearea")
    statement = feedback = ""
    body = _escaped(el.text).strip()
    for child in el:
        if "data-question" in child.attrib:
            statement = inner_html(child)
            body += _escaped(child.tail).strip()
        elif "data-feedback" in child.attrib:
            feedback = inner_html(child)
            body += _escaped(child.tail).strip()
        else:
            body += _outer_html(child, with_tail=True)
    return {"statement": statement, "feedback": feedback, "questionText": body.strip()}


def _selectquestion(cx):
    el = cx.el
    cx.check_attributes(
        el,
        _COMMON_ATTRIBUTES
        | {
            "data-questionlist",
            "data-ab",
            "data-toggleoptions",
            "data-togglelabels",
            "data-limit-basecourse",
        },
        defaults={"data-points": "1"},
        what="selectquestion",
    )

    def split(value):
        return [v.strip() for v in (value or "").split(",") if v.strip()]

    questions = split(el.get("data-questionlist"))
    result = {
        "questionList": questions,
        "questionLabels": {},
        "dataLimitBasecourse": el.get("data-limit-basecourse") == "true",
    }
    if el.get("data-ab"):
        result["abExperimentName"] = el.get("data-ab")
    toggles = split(el.get("data-toggleoptions"))
    if toggles:
        result["toggleOptions"] = toggles
        labels = split(
            (el.get("data-togglelabels") or "").removeprefix("togglelabels:")
        )
        # The builder writes a question's id when it has no label
        result["questionLabels"] = {
            q: label for q, label in zip(questions, labels) if label != q
        }
    return result


# The number PreTeXt ("1. ") and the builder ("1.&nbsp;") put before a choice
_POLL_NUMBER = re.compile(r"^\s*\d+\.[\s\xa0]*")


def _poll(cx):
    """A PreTeXt query: a statement, then one <li> per choice.

    A query with a scale is written as <li>1</li> ... <li>n</li>; one with
    choices numbers each <li> ("1. ...").
    """
    el = cx.el
    cx.check_attributes(el, _COMMON_ATTRIBUTES | {"data-results", "data-comment"})
    statement = _escaped(el.text).strip()
    items = []
    for child in el:
        if child.tag == "li":
            items.append(child)
        elif not items:
            statement += _outer_html(child, with_tail=True)
        else:
            cx.loss(f"poll child <{child.tag}> after the choices")
    texts = ["".join(li.itertext()).strip() for li in items]
    result = {"statement": statement.strip()}
    if (
        items
        and texts == [str(n) for n in range(1, len(items) + 1)]
        and not any(len(li) for li in items)
    ):
        result.update(poll_type="scale", scale_min=1, scale_max=len(items))
        result["optionList"] = [{"choice": text} for text in texts]
    else:
        result["poll_type"] = "options"
        result["optionList"] = [
            {"choice": _POLL_NUMBER.sub("", inner_html(li), count=1)} for li in items
        ]
    # poll.js shows students the results only for "all"; anything else is
    # instructor only, the default.
    if el.get("data-results") == "all":
        result["results"] = "all"
    return result


CONVERTERS: dict[str, Callable] = {
    "poll": _poll,
    "mchoice": _mchoice,
    "shortanswer": _shortanswer,
    "activecode": _activecode,
    "parsonsprob": _parsonsprob,
    "fillintheblank": _fillintheblank,
    "dragndrop": _dragndrop,
    "matching": _matching,
    "clickablearea": _clickablearea,
    "selectquestion": _selectquestion,
}


def convert_question(qtype, el, htmlsrc=None):
    """Convert a question's component element to its ``question_json``.

    ``qtype`` is the question_type stored for the question, ``el`` the element
    carrying ``data-component`` and ``htmlsrc`` the question's ``<htmlsrc>``
    (used to find content around the component). Returns None for a
    question_type with no converter, otherwise a Conversion.
    """
    converter = CONVERTERS.get(qtype)
    if converter is None or el is None:
        return None
    cx = _Context(el, htmlsrc)
    try:
        result = converter(cx)
    except Exception as e:  # malformed book HTML must not stop a build
        cx.loss(f"conversion failed: {e!r}")
        result = None
    _check_outside_content(cx)
    return Conversion(question_json=result, losses=cx.losses, ignored=cx.ignored)


# Elements HTML writes without an end tag. Any other element written as
# ``<x/>`` must be expanded before HTML parsing, which reads it as an open tag.
_VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}  # fmt: skip
_SELF_CLOSING = re.compile(r"<([A-Za-z][\w:-]*)((?:\s[^<>]*?)?)\s*/>")


def _expand_self_closing(markup):
    def expand(m):
        tag = m.group(1)
        if tag.lower() in _VOID_ELEMENTS:
            return m.group(0)
        return f"<{tag}{m.group(2)}></{tag}>"

    return _SELF_CLOSING.sub(expand, markup)


def parse_htmlsrc(markup):
    """Parse a question's stored ``htmlsrc`` into an ``<htmlsrc>`` element.

    PreTeXt books store XHTML, which may have ``<li .../>`` and must be read
    as XML; RST books store HTML, which often isn't well formed XML (``<br>``,
    ``&nbsp;``), so fall back to the HTML parser.
    """
    try:
        return ET.fromstring(f"<htmlsrc>{markup}</htmlsrc>")
    except ET.XMLSyntaxError:
        return lxml.html.fragment_fromstring(
            _expand_self_closing(markup), create_parent="htmlsrc"
        )


def convert_htmlsrc(qtype, markup):
    """Convert a question's stored ``htmlsrc`` string to its ``question_json``.

    Like :func:`convert_question`, but for a question already in the
    database. Returns None for a question_type with no converter.
    """
    if qtype not in CONVERTERS or not (markup or "").strip():
        return None
    cx = _Context(None, None)
    try:
        root = parse_htmlsrc(markup)
    except Exception as e:
        cx.loss(f"htmlsrc does not parse: {e!r}")
        return Conversion(question_json=None, losses=cx.losses, ignored=cx.ignored)
    el = root.find(".//*[@data-component]")
    if el is None:
        cx.loss("no element with data-component")
        return Conversion(question_json=None, losses=cx.losses, ignored=cx.ignored)
    return convert_question(qtype, el, root)
