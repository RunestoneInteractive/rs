"""
Tests for extract_parsons_code, which pulls the Parsons markup out of a backup
problem's stored HTML for CodeTailor.

Some stored markup keeps a bare "<" in its code ("if close < low_close:").
Tag stripping used to run from that "<" to the next ">" -- often in the
paired distractor -- deleting the code and the "---" between them, so the
correct block merged into its distractor and was dropped from the puzzle.
"""

from rsptx.book_server_api.routers.coach import (
    extract_parsons_code,
    extract_parsons_solution,
)
from rsptx.book_server_api.routers.personalized_parsons.subgoal_labels import (
    build_label_puzzle,
)

_BLOCKS = """\
import csv
---
def find_lowest_close():
    # set up variables to track the lowest close
    low_close = 100000
    low_date = ""
---
    # loop through each row
    for row in csv_file:
---
        # update the lowest close and date if the new close is lower
        if close {lt} low_close:
            low_close = close
            low_date = date
---
        # update the lowest close and date if the new close is lower
        if close > low_close:
            low_close = close
            low_date = date #paired
---
    # return the lowest close and its date
    return (low_close, low_date)
"""


def _question_html(blocks):
    return f"""
<div class="runestone">
  <div data-component="parsons" id="stocks_pp" class="parsons">
    <div class="parsons_question">
      <p>Create the function <code>find_lowest_close()</code>.</p>
    </div>
    <pre class="parsonsblocks" data-question_label="stocks_pp" data-language="python">
{blocks}    </pre>
  </div>
</div>"""


def test_bare_lt_keeps_correct_block_apart_from_its_distractor():
    code = extract_parsons_code(_question_html(_BLOCKS.format(lt="<")))
    blocks = code.split("\n---\n")
    assert len(blocks) == 6
    assert "if close &lt; low_close:" in blocks[3]
    assert "#paired" not in blocks[3]
    assert "if close > low_close:" in blocks[4]


def test_bare_lt_matches_escaped_markup():
    raw = extract_parsons_code(_question_html(_BLOCKS.format(lt="<")))
    escaped = extract_parsons_code(_question_html(_BLOCKS.format(lt="&lt;")))
    assert raw == escaped


def test_bare_lt_keeps_label_in_subgoal_puzzle():
    code = extract_parsons_code(_question_html(_BLOCKS.format(lt="<")))
    solution, _ = build_label_puzzle(
        code, "python", header=["def find_lowest_close():"]
    )
    assert (
        "        # update the lowest close and date if the new close is lower"
        in solution.splitlines()
    )


def test_bare_lt_survives_in_solution_code():
    code = extract_parsons_code(_question_html(_BLOCKS.format(lt="<")))
    assert (
        "        if close < low_close:" in extract_parsons_solution(code).splitlines()
    )


def test_html_tags_are_still_removed():
    code = extract_parsons_code(
        _question_html("x = 1\n---\n<span class='hl'>y = 2</span>\n")
    )
    assert code == "x = 1\n---\ny = 2"
