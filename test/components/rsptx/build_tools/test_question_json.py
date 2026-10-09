# Tests for converting the HTML of a book question to its question_json. The
# fixtures are trimmed from the PreTeXt sample book's runestone-manifest.xml.
import lxml.etree as ET

from rsptx.build_tools.question_json import convert_htmlsrc, convert_question


def convert(qtype, html):
    htmlsrc = ET.fromstring(f"<htmlsrc>{html}</htmlsrc>")
    return convert_question(qtype, htmlsrc.find(".//*[@data-component]"), htmlsrc)


def test_unknown_question_type_has_no_converter():
    assert convert("youtube", '<div data-component="youtube" id="v"/>') is None


def test_mchoice_with_statement_inside_the_list():
    c = convert(
        "mchoice",
        """<div class="runestone"><ul data-component="multiplechoice"
             data-multipleanswers="false" id="q">
          <div class="para">Every vector space has finite dimension.</div>
          <li data-component="answer" id="q_opt_t"><p>True.</p></li>
          <li data-component="feedback" id="q_opt_t">Think of polynomials.</li>
          <li data-component="answer" id="q_opt_f" data-correct=""><p>False.</p></li>
          <li data-component="feedback" id="q_opt_f">Right.</li>
        </ul></div>""",
    )
    assert c.lossless
    assert c.question_json == {
        "statement": '<div class="para">Every vector space has finite dimension.</div>',
        "optionList": [
            {
                "choice": "<p>True.</p>",
                "feedback": "Think of polynomials.",
                "correct": False,
            },
            {"choice": "<p>False.</p>", "feedback": "Right.", "correct": True},
        ],
        "forceCheckboxes": False,
        "random": False,
    }


def test_mchoice_with_statement_beside_the_list():
    c = convert(
        "mchoice",
        """<div class="runestone">
          <div class="exercise-statement"><div class="para">Pick one.</div></div>
          <ul data-component="multiplechoice" data-multipleanswers="true" id="q">
            <li data-component="answer" id="a" data-correct="">A</li>
            <li data-component="feedback">Yes</li>
          </ul></div>""",
    )
    # the statement beside the list isn't content outside the component
    assert c.lossless
    assert c.question_json["statement"] == '<div class="para">Pick one.</div>'
    # one correct answer, but checkboxes were asked for
    assert c.question_json["forceCheckboxes"] is True


def test_mchoice_random_order():
    c = convert(
        "mchoice",
        '<ul data-component="multiplechoice" data-multipleanswers="false" '
        'data-random="" id="q"><li data-component="answer">A</li></ul>',
    )
    assert c.lossless
    assert c.question_json["random"] is True


def test_content_outside_the_component_is_ignored():
    c = convert(
        "shortanswer",
        """<div class="introduction"><div class="para">Read this first.</div></div>
        <div class="ptx-runestone-container"><div class="runestone">
          <div data-component="shortanswer" class="journal" data-mathjax="" id="q">
            <div class="para">Explain.</div></div></div></div>
        <div class="solutions"><details>Hint</details></div>""",
    )
    assert c.question_json == {
        "statement": '<div class="para">Explain.</div>',
        "attachment": False,
    }
    # hints, solutions and introductions belong to the book, not the question
    assert c.lossless
    assert c.ignored == [
        "div@data-mathjax",
        "content outside the component: <div class='introduction'>",
        "content outside the component: <div class='solutions'>",
    ]


def test_shortanswer_attachment():
    c = convert(
        "shortanswer",
        '<div data-component="shortanswer" data-attachment="" id="q">Upload it.</div>',
    )
    assert c.lossless
    assert c.question_json == {"statement": "Upload it.", "attachment": True}


def test_activecode_splits_prefix_starter_and_suffix():
    c = convert(
        "activecode",
        """<div data-component="activecode" id="ac">
          <div class="ac_question exercise-statement" id="ac_question">
            <div class="para">Write add.</div></div>
          <textarea data-lang="python" data-audio="" data-coach="true" id="ac_editor"
            data-codelens="true" data-timelimit="25000" data-stdin="5"
            data-datafile="a.csv, b.csv">def add(a, b):
^^^^
    # TODO
====
assert add(2, 3) == 5
</textarea></div>""",
    )
    assert c.lossless, c.losses
    assert c.question_json == {
        "instructions": '<div class="para">Write add.</div>',
        "language": "python",
        "prefix_code": "def add(a, b):",
        "starter_code": "    # TODO",
        "suffix_code": "assert add(2, 3) == 5\n",
        "stdin": "5",
        "selectedExistingDataFiles": ["a.csv", "b.csv"],
        "enableCodeTailor": False,
        "parsonspersonalize": "",
        "parsonsexample": "",
        "parsonsPersonalized": True,
        "enableCodelens": True,
    }
    assert "textarea@data-timelimit=25000" in c.ignored


def test_activecode_options_and_code_sections():
    c = convert(
        "activecode",
        """<div data-component="activecode" id="ac" data-filename="main.cpp"><textarea
            data-lang="cpp" data-compileargs="['-Wall']" data-timelimit="1000"
            data-add-files="add_h,add_cpp" data-include="first second"
            data-autorun="yes" data-hidecode="no" data-highlight-lines="1-2,5"
            >hidden
^^^^
#include &lt;iostream&gt;
^^^!
int main() {
===!
}
====
tests
===iotests===
[{"input":"1\\n","out":"*\\n"}]
</textarea></div>""",
    )
    assert c.lossless, c.losses
    j = c.question_json
    assert j["prefix_code"] == "hidden"
    assert j["visible_prefix_code"] == "#include <iostream>"
    assert j["starter_code"] == "int main() {"
    assert j["visible_suffix_code"] == "}"
    assert j["suffix_code"] == "tests\n"
    assert j["iotests"] == [{"input": "1\n", "out": "*\n"}]
    assert j["filename"] == "main.cpp"
    assert j["timeLimit"] == 1000
    assert j["compileArgs"] == "['-Wall']"
    assert j["addFiles"] == ["add_h", "add_cpp"]
    assert j["includes"] == ["first", "second"]
    assert j["highlightLines"] == "1-2,5"
    assert (j["autoRun"], j["hideCode"]) == (True, False)
    assert "linkArgs" not in j


def test_activecode_unknown_attribute_is_a_loss():
    c = convert(
        "activecode",
        '<div data-component="activecode" id="ac">'
        '<textarea data-lang="python" data-mystery="1">x = 1</textarea></div>',
    )
    assert c.losses == ["textarea@data-mystery"]


def test_parsons_blocks():
    c = convert(
        "parsonsprob",
        """<div data-component="parsons" class="parsons" id="p">
          <div class="parsons_question parsons-text"><div class="para">Order it.</div></div>
          <pre class="parsonsblocks" data-question_label="" style="visibility: hidden;"
            data-language="python" data-adaptive="true" data-noindent="false"
            data-numbered="left" data-order="1,0,2,3">while candidates:
---
    p = candidates[0]
    if p &gt; 1:
        primes.append(p)
---
    p = 0 #paired: Not zero.
---
x = 1 #distractor</pre></div>""",
    )
    assert c.lossless, c.losses
    assert c.question_json == {
        "instructions": '<div class="para">Order it.</div>',
        "language": "python",
        "blocks": [
            {
                "id": "block-1",
                "content": "while candidates:",
                "indent": 0,
                "displayOrder": 1,
            },
            {
                "id": "block-2",
                "content": "p = candidates[0]\nif p &gt; 1:\n    primes.append(p)",
                "indent": 1,
                "displayOrder": 0,
            },
            {
                "id": "block-3",
                "content": "p = 0",
                "indent": 1,
                "isDistractor": True,
                "isPaired": True,
                "pairedWithBlockAbove": True,
                "explanation": "Not zero.",
                "displayOrder": 2,
            },
            {
                "id": "block-4",
                "content": "x = 1",
                "indent": 0,
                "isDistractor": True,
                "displayOrder": 3,
            },
        ],
        "adaptive": True,
        "numbered": "left",
        "noindent": False,
        "grader": "line",
        "orderMode": "custom",
        "customOrder": [1, 0, 2, 3],
    }


def test_parsons_dag_tags():
    c = convert(
        "parsonsprob",
        """<div data-component="parsons" id="p"><pre class="parsonsblocks"
          data-language="python" data-grader="dag">import math #tag:math; depends:;
---
c = math.sqrt(2) #tag:c; depends:math;</pre></div>""",
    )
    assert c.lossless
    assert c.question_json["grader"] == "dag"
    assert c.question_json["numbered"] == "none"
    assert c.question_json["blocks"] == [
        {
            "id": "block-1",
            "content": "import math",
            "indent": 0,
            "tag": "math",
            "depends": [],
        },
        {
            "id": "block-2",
            "content": "c = math.sqrt(2)",
            "indent": 0,
            "tag": "c",
            "depends": ["math"],
        },
    ]


# Older PreTeXt: the problem is markup around a list of feedback rules
FITB_LIST = """<div data-component="fillintheblank" id="f">
<div class="para">Declare <input type="text" placeholder="Text" size="2"/> age =
<input type="text" placeholder="Number" size="3"/>;</div><script type="application/json">
[[{"regex": "^\\\\s*int\\\\s*$", "regexFlags": "", "feedback": "Right type."},
  {"regex": "^\\\\s*.*\\\\s*$", "regexFlags": "", "feedback": "Use int."}],
 [{"number": [5, 5], "feedback": "Yes."},
  {"regex": "^\\\\s*.*\\\\s*$", "regexFlags": "", "feedback": "Use 5."}]]
</script></div>"""


def test_fillintheblank_list_form():
    c = convert("fillintheblank", FITB_LIST)
    assert c.lossless, c.losses
    assert c.question_json == {
        "questionText": '<div class="para">Declare {blank} age =\n{blank};</div>',
        "blanks": [
            {
                "id": "blank-1",
                "graderType": "string",
                "exactMatch": "int",
                "correctFeedback": "Right type.",
                "incorrectFeedback": "Use int.",
            },
            {
                "id": "blank-2",
                "graderType": "number",
                "numberMin": "5",
                "numberMax": "5",
                "correctFeedback": "Yes.",
                "incorrectFeedback": "Use 5.",
            },
        ],
    }
    assert c.ignored == ["fill-in <input> size/placeholder"]


def test_fillintheblank_dict_form_with_wrong_answer_feedback():
    c = convert(
        "fillintheblank",
        """<div data-component="fillintheblank" id="f"><script type="application/json">
        {"problemHtml": "&lt;p>0/0 is &lt;input type=\\"text\\" id=\\"b1\\"/>.&lt;/p>",
         "solutionHtml": "", "blankNames": {"blank1": 0},
         "feedbackArray": [[
           {"regex": "^\\\\s*indeterminate\\\\s*$", "regexFlags": "i", "feedback": "Correct!"},
           {"regex": "^\\\\s*undefined\\\\s*$", "regexFlags": "i", "feedback": "More specific."},
           {"feedback": "Incorrect."}]]}
        </script></div>""",
    )
    assert c.question_json == {
        "questionText": "<p>0/0 is {blank}.</p>",
        "blanks": [
            {
                "id": "blank-1",
                "graderType": "regex",
                "regexPattern": "indeterminate",
                "regexFlags": "i",
                "correctFeedback": "Correct!",
                "incorrectFeedback": "Incorrect.",
            }
        ],
    }
    # "More specific." for "undefined" can't be represented
    assert c.losses == ["fill-in blank with feedback for specific wrong answers"]


def test_dragndrop_markup_many_to_one_with_distractor():
    c = convert(
        "dragndrop",
        """<ul data-component="dragndrop" data-question_label="" id="d">
          <span data-subcomponent="question">Sort the food.</span>
          <li data-subcomponent="draggable" id="d_drag1" data-category="veg">Corn</li>
          <li data-subcomponent="dropzone" for="d_drag1" data-category="veg">Vegetable</li>
          <li data-subcomponent="draggable" id="d_drag2" data-category="veg">Peas</li>
          <li data-subcomponent="draggable" id="d_drag3">Rock</li>
          <span data-subcomponent="feedback">Not quite.</span>
        </ul>""",
    )
    assert c.lossless
    assert c.question_json == {
        "statement": "Sort the food.",
        "feedback": "Not quite.",
        "left": [
            {"id": "d_drag1", "label": "Corn"},
            {"id": "d_drag2", "label": "Peas"},
            {"id": "d_drag3", "label": "Rock"},
        ],
        "right": [{"id": "d_drop1", "label": "Vegetable"}],
        "correctAnswers": [["d_drag1", "d_drop1"], ["d_drag2", "d_drop1"]],
    }


def test_dragndrop_xml_with_card_feedback():
    c = convert(
        "dragndrop",
        """<div data-component="dragndrop" id="d"><script type="text/xml"><dragndrop>
          <statement>Classify.</statement><feedback/>
          <premise><id>d_drag1</id><label>-7</label></premise>
          <premise><id>d_drag2</id><label>i</label><feedback>Not real.</feedback></premise>
          <response><id>d_drop1</id><label>Integer</label></response>
          <answer premise="d_drag1" response="d_drop1"/>
        </dragndrop></script></div>""",
    )
    assert c.lossless
    assert c.question_json == {
        "statement": "Classify.",
        "feedback": "",
        "left": [
            {"id": "d_drag1", "label": "-7"},
            {"id": "d_drag2", "label": "i", "feedback": "Not real."},
        ],
        "right": [{"id": "d_drop1", "label": "Integer"}],
        "correctAnswers": [["d_drag1", "d_drop1"]],
    }


def test_matching_xml():
    c = convert(
        "matching",
        """<div data-component="matching" class="runestone" id="m"><script type="text/xml">
          <matching><statement>Match.</statement><feedback>Hint.</feedback>
            <premise><id>p1</id><label>Jack of Hearts</label></premise>
            <response><id>r1</id><label>Jack</label></response>
            <response><id>r2</id><label>Heart</label></response>
            <edge><label>p1</label><label>r1</label></edge>
            <edge><label>p1</label><label>r2</label></edge>
          </matching></script></div>""",
    )
    assert c.lossless
    assert c.question_json["correctAnswers"] == [["p1", "r1"], ["p1", "r2"]]
    assert c.question_json["left"] == [{"id": "p1", "label": "Jack of Hearts"}]


def test_clickablearea():
    c = convert(
        "clickablearea",
        """<div data-component="clickablearea" style="visibility: hidden;" id="c">
          <span data-question=""><div class="para">Click the nouns.</div></span>
          <span data-feedback=""><div class="para">Not pronouns.</div></span>
          <div class="para">The <span data-correct="">future</span> belongs to
            <span data-incorrect="">those</span>.</div></div>""",
    )
    assert c.lossless
    assert c.question_json == {
        "statement": '<div class="para">Click the nouns.</div>',
        "feedback": '<div class="para">Not pronouns.</div>',
        "questionText": '<div class="para">The <span data-correct="">future</span> '
        'belongs to\n            <span data-incorrect="">those</span>.</div>',
    }


def test_selectquestion():
    c = convert(
        "selectquestion",
        """<div data-component="selectquestion" data-points="1"
          data-limit-basecourse="false" id="s" data-ab="sample-book"
          data-toggleoptions="toggle, lock" data-togglelabels="togglelabels: First, q2"
          data-questionlist="q1, q2"><p>Loading...</p></div>""",
    )
    assert c.lossless
    assert c.question_json == {
        "questionList": ["q1", "q2"],
        # q2's label is just its id
        "questionLabels": {"q1": "First"},
        "dataLimitBasecourse": False,
        "abExperimentName": "sample-book",
        "toggleOptions": ["toggle", "lock"],
    }
    assert c.ignored == ["selectquestion@data-points=1"]


def test_malformed_html_is_reported_not_raised():
    c = convert(
        "fillintheblank",
        '<div data-component="fillintheblank" id="f"><script>{not json</script></div>',
    )
    assert c.question_json is None
    assert c.losses == ["fill-in JSON does not parse"]


def test_poll_with_choices():
    c = convert(
        "poll",
        """<ul data-component="poll" id="p" data-results="instructor">
          <div class="para">In my town, the stoplights have:</div>
          <li>1. <div class="para">Solid yellow lights.</div></li>
          <li>2. <div class="para">Blinking arrows.</div></li></ul>""",
    )
    assert c.lossless
    assert c.question_json == {
        "statement": '<div class="para">In my town, the stoplights have:</div>',
        "poll_type": "options",
        "optionList": [
            {"choice": '<div class="para">Solid yellow lights.</div>'},
            {"choice": '<div class="para">Blinking arrows.</div>'},
        ],
    }


def test_poll_with_a_scale():
    c = convert(
        "poll",
        '<ul data-component="poll" id="p" data-results="all">'
        "<div>Rate it.</div><li>1</li><li>2</li><li>3</li></ul>",
    )
    assert c.question_json == {
        "statement": "<div>Rate it.</div>",
        "poll_type": "scale",
        "scale_min": 1,
        "scale_max": 3,
        "optionList": [{"choice": "1"}, {"choice": "2"}, {"choice": "3"}],
        "results": "all",
    }
    assert c.lossless


def test_parsons_runnable_program():
    c = convert(
        "parsonsprob",
        """<div class="runestone parsons_section">
          <div data-component="parsons" class="parsons" id="p">
            <pre class="parsonsblocks" data-runnable="true" data-language="python"
              >def f(p):
---
    p.red = 0</pre>
          </div>
          <div style="display: none" id="p-runnable">
            <div data-component="parsons-runnable" id="p-runnable-ac">
              <textarea data-lang="python" data-audio="" data-coach="true"
                style="visibility: hidden;" data-codelens="false"
                data-datafile="golden-gate.png" data-timelimit="25000">
import image
==PARSONSCODE==
f(image.Image("golden-gate.png").getPixel(0, 0))
</textarea>
            </div>
          </div>
        </div>""",
    )
    # the hidden program is part of the question, not content beside it
    assert c.lossless, c.losses
    j = c.question_json
    assert j["runnable"] is True
    assert j["runnableCode"] == (
        "import image\n==PARSONSCODE==\n"
        'f(image.Image("golden-gate.png").getPixel(0, 0))\n'
    )
    assert j["runnableOptions"] == {
        "language": "python",
        "selectedExistingDataFiles": ["golden-gate.png"],
        "enableCodelens": False,
    }


def test_parsons_runnable_without_its_program_is_a_loss():
    c = convert(
        "parsonsprob",
        '<div data-component="parsons" id="p"><pre class="parsonsblocks" '
        'data-runnable="true">x = 1</pre></div>',
    )
    assert c.losses == ["runnable parsons without its program"]


def test_parsons_indentation_is_rescaled_to_four_space_levels():
    # A book indenting by 2 spaces: levels are kept, continuation lines too.
    c = convert(
        "parsonsprob",
        """<div data-component="parsons" id="p"><pre class="parsonsblocks"
          >def f():
---
  if x:
    y = 1
---
    return y</pre></div>""",
    )
    assert [(b["indent"], b["content"]) for b in c.question_json["blocks"]] == [
        (0, "def f():"),
        (1, "if x:\n    y = 1"),
        (2, "return y"),
    ]


def test_parsons_empty_dag_tag_gets_the_name_parsons_js_gives_it():
    c = convert(
        "parsonsprob",
        """<div data-component="parsons" id="p"><pre class="parsonsblocks"
          data-grader="dag">c = 1 #tag:c; depends:;
---
print(c) #tag:; depends:c;</pre></div>""",
    )
    assert c.question_json["blocks"][1]["tag"] == "block-1"
    assert c.question_json["blocks"][1]["depends"] == ["c"]


def test_parsons_block_ending_left_of_its_first_line():
    c = convert(
        "parsonsprob",
        """<div data-component="parsons" id="p"><pre class="parsonsblocks"
          >public class Hello
{
---
   public static void main(String[] args)
   {
---
      System.out.println("Hi");
---
   }
}</pre></div>""",
    )
    assert c.lossless
    assert [(b["indent"], b["content"]) for b in c.question_json["blocks"]] == [
        (0, "public class Hello\n{"),
        (1, "public static void main(String[] args)\n{"),
        (2, 'System.out.println("Hi");'),
        # the closing brace of the class keeps its place left of main's
        (0, "    }\n}"),
    ]


def test_stored_xhtml_htmlsrc_keeps_empty_feedback_items():
    # PreTeXt htmlsrc is XHTML, read as XML so that empty elements written
    # as <x/> stay empty.
    c = convert_htmlsrc(
        "mchoice",
        """<div class="ptx-runestone-container"><div class="runestone">
        <div class="exercise-statement"><div class="para">Pick one.</div></div>
        <ul data-component="multiplechoice" id="q" data-multipleanswers="false">
          <li data-component="answer" id="q_opt_a"><div class="para">A</div></li>
          <li data-component="feedback" id="q_opt_a"/>
          <li data-component="answer" id="q_opt_b" data-correct=""><div class="para">B</div></li>
          <li data-component="feedback" id="q_opt_b"/>
        </ul></div></div>""",
    )
    assert c.lossless
    assert [o["choice"] for o in c.question_json["optionList"]] == [
        '<div class="para">A</div>',
        '<div class="para">B</div>',
    ]
    assert [o["correct"] for o in c.question_json["optionList"]] == [False, True]


def test_stored_html_htmlsrc_that_is_not_xml():
    # RST htmlsrc is HTML: unquoted attributes, &nbsp; and <br>.
    c = convert_htmlsrc(
        "mchoice",
        """<div class="runestone ">
        <ul data-component="multiplechoice" data-multipleanswers="false" id=q>
        <p>Pick&nbsp;one.<br></p>
        <li data-component="answer" id="q_opt_a">A</li><li data-component="feedback">No.</li>
        <li data-component="answer" data-correct='yes' id="q_opt_b">B</li><li data-component="feedback">Yes.</li>
        </ul></div>""",
    )
    assert c.lossless
    assert c.question_json["statement"] == "<p>Pick\xa0one.<br/></p>"
    assert [o["feedback"] for o in c.question_json["optionList"]] == ["No.", "Yes."]


def test_stored_htmlsrc_without_a_component():
    c = convert_htmlsrc("mchoice", "<div>Just text</div>")
    assert not c.lossless
    assert c.losses == ["no element with data-component"]
    assert convert_htmlsrc("mchoice", "") is None
    assert convert_htmlsrc("codelens", "<div data-component='codelens'/>") is None
