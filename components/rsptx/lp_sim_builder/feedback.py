# ************************************************
# |docname| - Provide feedback for student answers
# ************************************************
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8
# <http://www.python.org/dev/peps/pep-0008/#imports>`_.
#
# Standard library
# ----------------
import ast
import json
import os
import re
import tempfile
from typing import Any, Dict, List, Optional

# Third-party imports
# -------------------
from runestone.lp.lp_common_lib import (
    STUDENT_SOURCE_PATH,
    code_here_comment,
    read_sphinx_config,
)

# Local imports
# -------------
from rsptx.db.models import runestone_component_dict
from .scheduled_builder import _scheduled_builder
from rsptx.configuration import settings
from rsptx.db.crud import fetch_course


# Code
# ====
# _`init_graders`: Install all the graders. While I'd prefer to include this functionality in `register_answer_table <register_answer_table>`, doing so would create a cycle of imports: the feedback functions below require an import of the models, while the models would require an import of these functions. So,
def init_graders():
    for table_name, grader in (
        ("fitb_answers", fitb_feedback),
        ("lp_answers", lp_feedback),
    ):
        runestone_component_dict[table_name].grader = grader


# Provide feedback for a fill-in-the-blank problem. This should produce
# identical results to the code in ``evaluateAnswers`` in ``fitb.js``.
async def fitb_feedback(
    # The validator for the ``fitb_answers`` table containing data before it's stored in the db. This function updates the grade stored in the validator.
    fitb_validator: Any,
    # The feedback to use when grading this question, taken from the ``feedback`` field of the ``fitb_answers`` table.
    feedback: Dict[Any, Any],
) -> Dict[str, Any]:
    # Grade based on this feedback. The new format is JSON; the old is
    # comma-separated.
    answer_json = fitb_validator.answer
    try:
        answer = json.loads(answer_json)
        # Some answers may parse as JSON, but still be in the old format. The
        # new format should always return an array.
        assert isinstance(answer, list)
    except Exception:
        answer = answer_json.split(",")
    displayFeed = []
    isCorrectArray: List[Optional[bool]] = []
    # The overall correctness of the entire problem.
    correct = True
    for blank, feedback_for_blank in zip(answer, feedback):
        if not blank:
            isCorrectArray.append(None)
            displayFeed.append("No answer provided.")
            correct = False
        else:
            # The correctness of this problem depends on if the first item matches.
            is_first_item = True
            # Check everything but the last answer, which always matches.
            for fb in feedback_for_blank[:-1]:
                if "regex" in fb:
                    if re.search(
                        fb["regex"], blank, re.I if fb["regexFlags"] == "i" else 0
                    ):
                        isCorrectArray.append(is_first_item)
                        if not is_first_item:
                            correct = False
                        displayFeed.append(fb["feedback"])
                        break
                else:
                    assert "number" in fb
                    min_, max_ = fb["number"]
                    try:
                        # Note that ``literal_eval`` does **not** discard leading / trailing spaces, but considers them indentation errors. So, explicitly invoke ``strip``.
                        val = ast.literal_eval(blank.strip())
                        in_range = val >= min_ and val <= max_
                    except Exception:
                        # In case something weird or invalid was parsed (dict, etc.)
                        in_range = False
                    if in_range:
                        isCorrectArray.append(is_first_item)
                        if not is_first_item:
                            correct = False
                        displayFeed.append(fb["feedback"])
                        break
                is_first_item = False
            # Nothing matched. Use the last feedback.
            else:
                isCorrectArray.append(False)
                correct = False
                displayFeed.append(feedback_for_blank[-1]["feedback"])

    # Note that this isn't a percentage, but a ratio where 1.0 == all correct.
    percent = (
        isCorrectArray.count(True) / len(isCorrectArray) if len(isCorrectArray) else 0
    )

    # Update the values to be stored in the db.
    fitb_validator.correct = correct
    fitb_validator.percent = percent

    # Return grading results to the client for a non-exam scenario.
    if settings.is_exam:
        return dict(
            correct=True,
            displayFeed=["Response recorded."] * len(answer),
            isCorrectArray=[True] * len(answer),
            percent=1,
        )
    else:
        return dict(
            correct=correct,
            displayFeed=displayFeed,
            isCorrectArray=isCorrectArray,
            percent=percent,
        )


# lp feedback
# ===========
async def lp_feedback(lp_validator: Any, feedback: Dict[Any, Any]):
    # Begin by reformatting the answer for storage in the database. Do this now, so the code will be stored correctly even if the function returns early due to an error.
    try:
        code_snippets = json.loads(lp_validator.answer)
    except Exception:
        lp_validator.answer = json.dumps({})
        return {"errors": [f"Unable to load answers from '{lp_validator.answer}'."]}
    lp_validator.answer = json.dumps(dict(code_snippets=code_snippets))

    course = await fetch_course(lp_validator.course_name)
    sphinx_base_path = os.path.join(settings.book_path, course.base_course)
    source_path = feedback["source_path"]
    # Read the Sphinx config file to find paths relative to this directory.
    sphinx_config = read_sphinx_config(sphinx_base_path)
    if not sphinx_config:
        return {
            "errors": [
                f"Unable to load Sphinx configuration file from {sphinx_base_path}"
            ]
        }
    sphinx_source_path = sphinx_config["SPHINX_SOURCE_PATH"]
    sphinx_out_path = sphinx_config["SPHINX_OUT_PATH"]

    # Next, read the student source in for the program the student is working on.
    try:
        # Find the path to the student source file.
        abs_source_path = os.path.normpath(
            os.path.join(
                sphinx_base_path, sphinx_out_path, STUDENT_SOURCE_PATH, source_path
            )
        )
        with open(abs_source_path, encoding="utf-8") as f:
            source_str = f.read()
    except Exception as e:
        return {"errors": [f"Cannot open source file {abs_source_path}: {e}."]}

    # Create a snippet-replaced version of the source, by looking for "put code
    # here" comments and replacing them with the provided code. To do so,
    # first split out the "put code here" comments.
    split_source = source_str.split(code_here_comment(source_path))
    # Sanity check! Source with n "put code here" comments splits into n+1
    # items, into which the n student code snippets should be interleaved.
    if len(split_source) - 1 != len(code_snippets):
        return {"errors": ["Wrong number of snippets."]}
    # Interleave these with the student snippets.
    interleaved_source = [""] * (2 * len(split_source) - 1)
    interleaved_source[::2] = split_source
    try:
        interleaved_source[1::2] = _platform_edit(
            feedback["builder"], code_snippets, source_path
        )
    except Exception as e:
        return {"errors": [f"An exception occurred: {e}"]}
    # Join them into a single string. Make sure newlines separate everything.
    source_str = "\n".join(interleaved_source)

    # Create a temporary directory, then write the source there.
    with tempfile.TemporaryDirectory() as temp_path:
        temp_source_path = os.path.join(temp_path, os.path.basename(source_path))
        with open(temp_source_path, "w", encoding="utf-8") as f:
            f.write(source_str)

        try:
            res = _scheduled_builder.delay(
                feedback["builder"],
                temp_source_path,
                sphinx_base_path,
                sphinx_source_path,
                sphinx_out_path,
                source_path,
            )
            output, correct = res.get(timeout=60)
        except Exception as e:
            return {"errors": [f"Error in build task: {e}"]}
        else:
            # Strip whitespace and return only the last 4K or data or so.
            # There's no need for more -- it's probably just a crashed or
            # confused program spewing output, so don't waste bandwidth or
            # storage space on it.
            resultString = output.strip()[-4096:]
            # Update the data to be stored in the database.
            lp_validator.answer = json.dumps(
                dict(code_snippets=code_snippets, resultString=resultString)
            )
            lp_validator.correct = correct
            # Return just new data (not the code snippets) to the client.
            return {
                # The answer.
                "answer": {"resultString": resultString},
                "correct": correct,
            }


# This function should take a list of code snippets and modify them to prepare
# for the platform-specific compile. For example, add a line number directive
# to the beginning of each.
def _platform_edit(
    # The builder which will be used to build these snippets.
    builder,
    # A list of code snippets submitted by the user.
    code_snippets,
    # The name of the source file into which these snippets will be inserted.
    source_path,
):
    # Prepend a line number directive to each snippet.
    #
    # Select what to prepend based on the language.
    ext = os.path.splitext(source_path)[1]
    if ext == ".c":
        fmt = '#line 1 "box {}"\n'
    elif ext == ".s" or ext == ".S":
        # I can't get this to work in the `gnu assembler <https://gcc.gnu.org/onlinedocs/cpp/Line-Control.html>`_. I tried:
        #
        # - From Section 4.11 (Misc directives):
        #
        #   -   ``.appline 1``
        #   -   ``.ln 1`` (produces the message ``Error: unknown pseudo-op: `.ln'``.
        #       But if I use the assembly option ``-a``, the listing file shows that
        #       this directive inserts line 1 of the source .s file into the listing
        #       file. ???
        #   -   ``.loc 1 1`` (trying ``.loc 1, 1`` produces ``Error: rest of line
        #       ignored; first ignored character is `,'``)
        #
        # - From Section 4.12 (directives for debug information):
        #
        #   -   ``.line 1``. I also tried this inside a ``.def/.endef`` pair, which
        #       just produced error messages.
        #
        # Perhaps saving each snippet to a file, then including them via ``.include`` would help. Ugh.
        fmt = ""
    elif ext == ".py":
        # Python doesn't (easily) support `setting line numbers <https://lists.gt.net/python/python/164854>`__.
        fmt = ""
    elif ext == ".rs":
        # Rust doesn't support `setting line numbers <https://github.com/rust-lang/rfcs/issues/1862>`__ either.
        fmt = ""
    elif ext == ".v":
        # Quoting from section 19.7 of the IEEE Standard for Verilog Hardware Description Language (IEEE Std 1364-2005), the syntax for this compiler directive is ```line number "filename" level``, where ``level == 0`` indicates that this line doesn't precede or follow an include directive.
        fmt = '`line 1 "box {}" 0\n'
    else:
        # This is an unsupported language. It would be nice to report this as an error instead of raising an exception.
        raise RuntimeError(f"Unsupported extension {ext}")
    return [
        fmt.format(index + 1) + code_snippets[index]
        for index in range(len(code_snippets))
    ]
