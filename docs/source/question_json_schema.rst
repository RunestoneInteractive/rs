Question JSON Schema
====================

Purpose
-------

This document defines the standardized JSON schema for the ``question_json`` field
stored on every question/exercise record in the Runestone system. The
``question_json`` field is a JSON-encoded string that contains the type-specific
content and configuration for a question, which are the fields that vary depending
on ``question_type``.

Source of Truth
---------------

.. list-table::
   :header-rows: 1

   * - File
     - Role
   * - bases/rsptx/assignment_server_api/assignment_builder/src/types/exercises.ts
     - TypeScript ``QuestionJSON`` type, canonical field-level definition
   * - bases/rsptx/assignment_server_api/assignment_builder/src/utils/questionJson.ts
     - Builder (``buildQuestionJson``), defaults (``getDefaultQuestionJson``), and merge logic (``mergeQuestionJsonWithDefaults``)

Supported Question Types
------------------------

Defined in ``QuestionType`` (Python) and ``supportedExerciseTypes`` (TypeScript):

.. list-table::
   :header-rows: 1

   * - question_type
     - Display Name
     - Description
   * - activecode
     - Active Code
     - Interactive coding exercise with real-time execution
   * - mchoice
     - Multiple Choice
     - Single or multiple correct answers
   * - shortanswer
     - Short Answer
     - Free-text response
   * - poll
     - Poll
     - Survey/feedback question
   * - dragndrop
     - Drag and Drop
     - Match or order items by dragging
   * - matching
     - Matching
     - Match items from two different sets
   * - parsonsprob
     - Parsons Problem
     - Arrange code blocks in correct order
   * - fillintheblank
     - Fill in the Blank
     - Text with blanks to complete
   * - selectquestion
     - Select Question
     - Meta-question that selects from a pool
   * - clickablearea
     - Clickable Area
     - Identify areas in text or images
   * - iframe
     - iFrame
     - Embed external content via an iframe

.. note::

   Additional types exist in the backend enum (``video``, ``codelens``, ``youtube``,
   ``hparsons``, ``actex``, ``page``, ``webwork``) but are not currently supported in
   the assignment builder UI and do not have a ``question_json`` builder path.

Field Reference
---------------

All fields within ``question_json`` are optional at the top level
(``Partial<{...}>``). Only fields relevant to a particular ``question_type`` are
populated when the JSON is built.

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Used By Question Type(s)
     - Description
   * - statement
     - string
     - mchoice, poll, shortanswer, dragndrop, matching, clickablearea
     - Main question/prompt text displayed to the student
   * - instructions
     - string
     - activecode, parsonsprob
     - Instructions shown above the coding/ordering area
   * - questionText
     - string
     - fillintheblank, clickablearea
     - Question body text (each ``{blank}`` marks a blank in FITB)
   * - language
     - string
     - activecode, parsonsprob
     - Programming language (for example: "python", "java", "cpp")
   * - prefix_code
     - string
     - activecode
     - Hidden code prepended before student code during execution
   * - starter_code
     - string
     - activecode
     - Initial code shown in the editor
   * - suffix_code
     - string
     - activecode
     - Hidden code appended after student code (typically unit tests)
   * - stdin
     - string
     - activecode
     - Standard input provided at runtime
   * - selectedExistingDataFiles
     - string[]
     - activecode
     - List of data file names available to the exercise
   * - enableCodeTailor
     - boolean
     - activecode
     - Enable CodeTailor personalized help feature
   * - parsonspersonalize
     - "" | "movable" | "partial"
     - activecode
     - CodeTailor Parsons personalization mode
   * - parsonsexample
     - string
     - activecode
     - Example question ID used by CodeTailor
   * - parsonsPersonalized
     - boolean
     - activecode
     - When false, CodeTailor skips personalization and returns the predefined example Parsons puzzle instead of inspecting the student's code (default: true)
   * - enableCodelens
     - boolean
     - activecode
     - Enable Codelens step-through debugger
   * - visible_prefix_code
     - string
     - activecode
     - Code before the student's code that is shown but can't be edited (``^^^!``)
   * - visible_suffix_code
     - string
     - activecode
     - Code after the student's code that is shown but can't be edited (``===!``)
   * - iotests
     - IoTest[] (see IoTest section)
     - activecode
     - Input/output tests run against the program (``===iotests===``)
   * - filename
     - string
     - activecode
     - File name of this activecode when another one adds it with ``addFiles``
   * - timeLimit
     - number
     - activecode
     - Run time limit in milliseconds (default: 25000)
   * - compileArgs
     - string
     - activecode
     - Compiler arguments, e.g. ``['-std=c++17', '-Wall']``
   * - linkArgs
     - string
     - activecode
     - Linker arguments
   * - runArgs
     - string
     - activecode
     - Arguments passed to the program when it runs
   * - interpreterArgs
     - string
     - activecode
     - Arguments passed to the interpreter
   * - addFiles
     - string[]
     - activecode
     - Ids of other activecodes or datafiles whose contents are added as files
   * - compileAlso
     - string
     - activecode
     - Additional source files to compile with the program
   * - sourceFile
     - string
     - activecode
     - File name to save the student's code as
   * - highlightLines
     - string
     - activecode
     - Lines to highlight, e.g. ``1-2,5``
   * - includes
     - string[]
     - activecode
     - Ids of activecodes whose code runs before this one
   * - dbUrl
     - string
     - activecode
     - URL of the SQLite database for an SQL activecode
   * - autoRun
     - boolean
     - activecode
     - Run the code when the page loads
   * - hideCode
     - boolean
     - activecode
     - Hide the editor, showing only the output
   * - hideHistory
     - boolean
     - activecode
     - Hide the history scrubber
   * - enableDownload
     - boolean
     - activecode
     - Show a button to download the code
   * - gradeButton
     - boolean
     - activecode
     - Show a button to show the grade
   * - noPair
     - boolean
     - activecode
     - Disable pair programming for this activecode
   * - showLastSql
     - boolean
     - activecode
     - For SQL, show only the result of the last statement
   * - chatCodes
     - boolean
     - activecode
     - Enable chat.codes sharing
   * - tie
     - string
     - activecode
     - Id of a related element to tie this activecode to
   * - caption
     - string
     - activecode
     - Caption shown under the activecode
   * - attachment
     - boolean
     - shortanswer
     - Whether file attachment upload is allowed
   * - optionList
     - Option[] (see Option section)
     - mchoice, poll
     - List of answer options
   * - forceCheckboxes
     - boolean
     - mchoice
     - Force checkbox UI for multiple-select
   * - random
     - boolean
     - mchoice
     - Show the answers in a random order
   * - poll_type
     - string
     - poll
     - Poll display type
   * - scale_min
     - number
     - poll
     - Minimum value for scale-type polls
   * - scale_max
     - number
     - poll
     - Maximum value for scale-type polls
   * - results
     - "instructor" | "all"
     - poll
     - Who sees the results: ``"all"`` shows students the class's votes after
       they vote; instructors always see them
   * - left
     - MatchItem[] (see MatchItem section)
     - dragndrop, matching
     - Left-side items for matching and drag-and-drop
   * - right
     - MatchItem[] (see MatchItem section)
     - dragndrop, matching
     - Right-side items for matching and drag-and-drop
   * - correctAnswers
     - string[][]
     - dragndrop, matching
     - Array of [leftId, rightId] pairs defining correct matches
   * - feedback
     - string
     - dragndrop, matching, clickablearea
     - Feedback text shown on incorrect answer
   * - blocks
     - ParsonsBlock[] (see ParsonsBlock section)
     - parsonsprob
     - Code blocks for Parsons problems
   * - adaptive
     - boolean
     - parsonsprob
     - Enable adaptive Parsons mode (provides hints)
   * - numbered
     - "left" | "right" | "none"
     - parsonsprob
     - Show line numbers and their position
   * - noindent
     - boolean
     - parsonsprob
     - Disable indentation in the Parsons problem
   * - grader
     - "line" | "dag"
     - parsonsprob
     - Grading strategy: line-by-line or DAG-based
   * - orderMode
     - "random" | "custom"
     - parsonsprob
     - Block presentation order
   * - customOrder
     - number[]
     - parsonsprob
     - Block indices in display order (``data-order``). With orderMode custom the builder orders blocks by each block's ``displayOrder`` instead, so set both
   * - runnable
     - boolean
     - parsonsprob
     - Once solved, run the student's code in ``runnableCode``
   * - runnableCode
     - string
     - parsonsprob
     - The program a solved runnable parsons runs; the student's code replaces ``==PARSONSCODE==``
   * - runnableOptions
     - object
     - parsonsprob
     - Options for that program, named as for activecode: ``language``, ``selectedExistingDataFiles``, ``enableCodelens``, and any activecode option from ``timeLimit`` on (e.g. ``compileArgs``, ``addFiles``)
   * - blanks
     - BlankWithFeedback[] (see BlankWithFeedback section)
     - fillintheblank
     - Definitions for each blank
   * - questionList
     - string[]
     - selectquestion
     - Pool of question IDs to select from
   * - questionLabels
     - Record<string, string>
     - selectquestion
     - Mapping of question IDs to human-readable labels
   * - abExperimentName
     - string
     - selectquestion
     - A/B experiment name for randomized question selection
   * - toggleOptions
     - string[]
     - selectquestion
     - Toggle configuration options
   * - dataLimitBasecourse
     - boolean
     - selectquestion
     - Limit question pool to the base course
   * - iframeSrc
     - string
     - iframe
     - URL of external content to embed

Sub-Object Schemas
------------------

Option
~~~~~~

Represents a single answer option for multiple-choice or poll questions.

Source: ``types/exercises.ts`` - ``interface Option``

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Required
     - Description
   * - choice
     - string
     - Yes
     - Text of the answer option
   * - feedback
     - string
     - No
     - Feedback shown when this option is selected
   * - correct
     - boolean
     - No
     - Whether this option is a correct answer

.. code-block:: json

   { "choice": "Paris", "feedback": "Correct!", "correct": true }

MatchItem
~~~~~~~~~

Represents a single item on the left or right side of a drag-and-drop or
matching exercise.

Source: ``types/exercises.ts`` - inline type on ``left`` and ``right`` fields

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Required
     - Description
   * - id
     - string
     - Yes
     - Unique identifier for the item (for example: "a", "x")
   * - label
     - string
     - Yes
     - Display text for the item
   * - feedback
     - string
     - No
     - dragndrop only: shown when this card is out of place (a premise not in
       its response, or a response holding the wrong premises), after the
       student's third incorrect check

.. code-block:: json

   { "id": "a", "label": "Python", "feedback": "Python checks types at run time." }


ParsonsBlock
~~~~~~~~~~~~

Represents a single code block in a Parsons problem.

Source: ``utils/preview/parsonsPreview.tsx`` - ``interface ParsonsBlock``

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Required
     - Description
   * - id
     - string
     - Yes
     - Unique identifier for the block
   * - content
     - string
     - Yes
     - Code/text content of the block
   * - indent
     - number
     - Yes
     - Indentation level (0-based)
   * - isDistractor
     - boolean
     - No
     - Whether this block is a distractor
   * - isPaired
     - boolean
     - No
     - Whether this block is part of a paired distractor
   * - groupId
     - string
     - No
     - Group identifier for paired distractors
   * - isCorrect
     - boolean
     - No
     - Whether this is a correct block
   * - tag
     - string
     - No
     - Tag for DAG grading dependencies
   * - depends
     - string[]
     - No
     - Tags of blocks this block depends on
   * - explanation
     - string
     - No
     - Explanation shown during adaptive feedback
   * - displayOrder
     - number
     - No
     - Position the block is shown in when orderMode is custom
   * - pairedWithBlockAbove
     - boolean
     - No
     - Whether this block is paired with the block immediately above

.. code-block:: json

   {
     "id": "block-1",
     "content": "def greet():",
     "indent": 0,
     "isDistractor": false,
     "tag": "def"
   }

BlankWithFeedback
~~~~~~~~~~~~~~~~~

Represents a single blank in a fill-in-the-blank question, including grading
configuration.

Source: ``components/.../FillInTheBlankExercise/types.ts`` -
``interface BlankWithFeedback``

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Required
     - Description
   * - id
     - string
     - Yes
     - Unique identifier for the blank
   * - graderType
     - "string" | "regex" | "number"
     - Yes
     - How this blank is graded
   * - exactMatch
     - string
     - No
     - Expected exact string (when graderType is string)
   * - regexPattern
     - string
     - No
     - Regex pattern to match (when graderType is regex)
   * - regexFlags
     - string
     - No
     - Regex flags, for example "i" for case-insensitive
   * - numberMin
     - string
     - No
     - Minimum acceptable number as string (number grader)
   * - numberMax
     - string
     - No
     - Maximum acceptable number as string (number grader)
   * - correctFeedback
     - string
     - No
     - Feedback shown on correct answer
   * - incorrectFeedback
     - string
     - No
     - Feedback shown on incorrect answer

.. code-block:: json

   {
     "id": "blank-1",
     "graderType": "regex",
     "regexPattern": "sorted|ordered",
     "regexFlags": "i",
     "correctFeedback": "Correct!",
     "incorrectFeedback": "Binary search requires a precondition on the input."
   }

IoTest
~~~~~~

One input/output test of an activecode program.

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Required
     - Description
   * - input
     - string
     - Yes
     - Text given to the program on standard input
   * - out
     - string
     - Yes
     - Output the program must print

.. code-block:: json

   { "input": "3\n", "out": "***\n***\n***\n" }

Per-Question-Type Field Mapping
-------------------------------

This section shows which fields are serialized into ``question_json`` for each
``question_type``, as implemented by ``buildQuestionJson()``.

activecode
~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Default
   * - prefix_code
     - string
     - ""
   * - starter_code
     - string
     - ""
   * - suffix_code
     - string
     - ""
   * - instructions
     - string
     - ""
   * - language
     - string
     - First available language option
   * - stdin
     - string
     - ""
   * - selectedExistingDataFiles
     - string[]
     - (none)
   * - enableCodeTailor
     - boolean
     - false
   * - parsonspersonalize
     - "" | "movable" | "partial"
     - ""
   * - parsonsexample
     - string
     - ""
   * - parsonsPersonalized
     - boolean
     - true
   * - enableCodelens
     - boolean
     - true
   * - visible_prefix_code
     - string
     - (none)
   * - visible_suffix_code
     - string
     - (none)
   * - iotests
     - IoTest[]
     - (none)
   * - filename
     - string
     - (none)
   * - timeLimit
     - number
     - 25000
   * - compileArgs
     - string
     - (none)
   * - linkArgs
     - string
     - (none)
   * - runArgs
     - string
     - (none)
   * - interpreterArgs
     - string
     - (none)
   * - addFiles
     - string[]
     - (none)
   * - compileAlso
     - string
     - (none)
   * - sourceFile
     - string
     - (none)
   * - highlightLines
     - string
     - (none)
   * - includes
     - string[]
     - (none)
   * - dbUrl
     - string
     - (none)
   * - autoRun
     - boolean
     - false
   * - hideCode
     - boolean
     - false
   * - hideHistory
     - boolean
     - false
   * - enableDownload
     - boolean
     - false
   * - gradeButton
     - boolean
     - false
   * - noPair
     - boolean
     - false
   * - showLastSql
     - boolean
     - false
   * - chatCodes
     - boolean
     - false
   * - tie
     - string
     - (none)
   * - caption
     - string
     - (none)

The fields from ``visible_prefix_code`` on are optional and are written only
when set; most come from books rather than the assignment builder.

mchoice
~~~~~~~

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Default
   * - statement
     - string
     - ""
   * - optionList
     - Option[]
     - Two empty options
   * - forceCheckboxes
     - boolean
     - false
   * - random
     - boolean
     - false

shortanswer
~~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Default
   * - attachment
     - boolean
     - false
   * - statement
     - string
     - ""

poll
~~~~

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Default
   * - statement
     - string
     - ""
   * - optionList
     - Option[]
     - Two empty options
   * - poll_type
     - "options" | "scale"
     - "options"
   * - scale_min
     - number
     - (none; 1 for a scale)
   * - scale_max
     - number
     - (none; the number of choices for a scale)
   * - results
     - "instructor" | "all"
     - "instructor"

A scale poll also lists its numbers in ``optionList`` (``"1"`` ... ``"n"``),
which is what the builder renders.

dragndrop
~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Default
   * - statement
     - string
     - ""
   * - left
     - MatchItem[]
     - [{ id: "a", label: "" }]
   * - right
     - MatchItem[]
     - [{ id: "x", label: "" }]
   * - correctAnswers
     - string[][]
     - [["a", "x"]]
   * - feedback
     - string
     - "Incorrect. Please try again."

matching
~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Default
   * - statement
     - string
     - ""
   * - left
     - MatchItem[]
     - [{ id: "a", label: "" }]
   * - right
     - MatchItem[]
     - [{ id: "x", label: "" }]
   * - correctAnswers
     - string[][]
     - [["a", "x"]]
   * - feedback
     - string
     - "Incorrect. Please try again."

parsonsprob
~~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Default
   * - blocks
     - ParsonsBlock[]
     - One empty block
   * - language
     - string
     - First available language option
   * - instructions
     - string
     - ""
   * - adaptive
     - boolean
     - true
   * - numbered
     - "left" | "right" | "none"
     - "left"
   * - noindent
     - boolean
     - false
   * - grader
     - "line" | "dag"
     - "line"
   * - orderMode
     - "random" | "custom"
     - "random"
   * - customOrder
     - number[]
     - (none)
   * - runnable
     - boolean
     - false
   * - runnableCode
     - string
     - (none)
   * - runnableOptions
     - object
     - (none)

A block's ``indent`` is its level: the builder writes 4 spaces per level in
front of every line of the block, and parsons.js grades the rank of each
line's indentation. Lines after the first keep their indentation relative to
the first line in ``content``.

fillintheblank
~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Default
   * - questionText
     - string
     - (none)
   * - blanks
     - BlankWithFeedback[]
     - (none)

selectquestion
~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Default
   * - questionList
     - string[]
     - (none)
   * - questionLabels
     - Record<string, string>
     - {}
   * - abExperimentName
     - string
     - (none)
   * - toggleOptions
     - string[]
     - (none)
   * - dataLimitBasecourse
     - boolean
     - (none)

clickablearea
~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Default
   * - questionText
     - string
     - (none)
   * - statement
     - string
     - ""
   * - feedback
     - string
     - "Incorrect. Please try again."

iframe
~~~~~~

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Default
   * - iframeSrc
     - string
     - (none)

Full Example JSON Objects
-------------------------

Active Code
~~~~~~~~~~~

.. code-block:: json

   {
     "prefix_code": "import math\\n",
     "starter_code": "def solve(n):\\n    # your code here\\n    pass",
     "suffix_code": "assert solve(5) == 120",
     "instructions": "Write a function that computes the factorial of n.",
     "language": "python",
     "stdin": "",
     "selectedExistingDataFiles": [],
     "enableCodeTailor": false,
     "parsonspersonalize": "",
     "parsonsexample": "",
     "parsonsPersonalized": true,
     "enableCodelens": true
   }

Multiple Choice
~~~~~~~~~~~~~~~

.. code-block:: json

   {
     "statement": "What is the capital of France?",
     "optionList": [
       { "choice": "London", "feedback": "London is the capital of the UK.", "correct": false },
       { "choice": "Berlin", "feedback": "Berlin is the capital of Germany.", "correct": false },
       { "choice": "Paris", "feedback": "Correct!", "correct": true },
       { "choice": "Madrid", "feedback": "Madrid is the capital of Spain.", "correct": false }
     ],
     "forceCheckboxes": false,
     "random": true
   }

Short Answer
~~~~~~~~~~~~

.. code-block:: json

   {
     "statement": "Explain the concept of polymorphism in object-oriented programming.",
     "attachment": false
   }

Poll
~~~~

.. code-block:: json

   {
     "statement": "How confident are you with recursion?",
     "optionList": [
       { "choice": "Very confident" },
       { "choice": "Somewhat confident" },
       { "choice": "Not confident" }
     ]
   }

Drag and Drop
~~~~~~~~~~~~~

.. code-block:: json

   {
     "statement": "Match each language to its type system.",
     "left": [
       { "id": "a", "label": "Python" },
       { "id": "b", "label": "Java" }
     ],
     "right": [
       { "id": "x", "label": "Dynamically typed" },
       { "id": "y", "label": "Statically typed" }
     ],
     "correctAnswers": [["a", "x"], ["b", "y"]],
     "feedback": "Incorrect. Please try again."
   }

Matching
~~~~~~~~

.. code-block:: json

   {
     "statement": "Match the data structure to its time complexity for search.",
     "left": [
       { "id": "a", "label": "Hash Table" },
       { "id": "b", "label": "Linked List" }
     ],
     "right": [
       { "id": "x", "label": "O(1) average" },
       { "id": "y", "label": "O(n)" }
     ],
     "correctAnswers": [["a", "x"], ["b", "y"]],
     "feedback": "Incorrect. Review the data structures chapter."
   }

Parsons Problem
~~~~~~~~~~~~~~~

.. code-block:: json

   {
     "instructions": "Arrange the code blocks to create a function that prints 'Hello World'.",
     "language": "python",
     "blocks": [
       { "id": "block-1", "content": "def greet():", "indent": 0 },
       { "id": "block-2", "content": "print('Hello World')", "indent": 1 },
       { "id": "block-3", "content": "greet()", "indent": 0 },
       { "id": "block-4", "content": "print('Goodbye')", "indent": 1, "isDistractor": true }
     ],
     "adaptive": true,
     "numbered": "left",
     "noindent": false
   }

Fill in the Blank
~~~~~~~~~~~~~~~~~

.. code-block:: json

   {
     "questionText": "The time complexity of binary search is O({blank}) and it requires a {blank} array.",
     "blanks": [
       {
         "id": "blank-1",
         "graderType": "string",
         "exactMatch": "log n",
         "correctFeedback": "Correct!",
         "incorrectFeedback": "Think about how the search space is halved each time."
       },
       {
         "id": "blank-2",
         "graderType": "regex",
         "regexPattern": "sorted|ordered",
         "regexFlags": "i",
         "correctFeedback": "Correct!",
         "incorrectFeedback": "Binary search has a precondition on the input."
       }
     ]
   }

Select Question
~~~~~~~~~~~~~~~

.. code-block:: json

   {
     "questionList": ["q-101", "q-102", "q-103"],
     "questionLabels": {
       "q-101": "Easy recursion",
       "q-102": "Medium recursion",
       "q-103": "Hard recursion"
     },
     "abExperimentName": "",
     "toggleOptions": [],
     "dataLimitBasecourse": true
   }

Clickable Area
~~~~~~~~~~~~~~

.. code-block:: json

   {
     "statement": "Click on the lines that contain a syntax error.",
     "questionText": "<pre>x = 10\\nif x = 10:\\n    print(x)\\n</pre>",
     "feedback": "Look for assignment vs. comparison operators."
   }

iFrame
~~~~~~

.. code-block:: json

   {
     "iframeSrc": "https://example.com/interactive-simulation"
   }

Default Values
--------------

When a new question is created, ``getDefaultQuestionJson()`` in
``questionJson.ts`` provides the following defaults:

.. list-table::
   :header-rows: 1

   * - Field
     - Default Value
   * - statement
     - ""
   * - language
     - First value from available language options
   * - instructions
     - ""
   * - prefix_code
     - ""
   * - starter_code
     - ""
   * - suffix_code
     - ""
   * - stdin
     - ""
   * - attachment
     - false
   * - optionList
     - [{ choice: "", feedback: "", correct: false }, { choice: "", feedback: "", correct: false }]
   * - left
     - [{ id: "a", label: "" }]
   * - right
     - [{ id: "x", label: "" }]
   * - correctAnswers
     - [["a", "x"]]
   * - feedback
     - "Incorrect. Please try again."
   * - blocks
     - [{ id: "block-<timestamp>", content: "", indent: 0 }]
   * - adaptive
     - true
   * - numbered
     - "left"
   * - noindent
     - false
   * - enableCodeTailor
     - false
   * - parsonspersonalize
     - ""
   * - parsonsexample
     - ""
   * - parsonsPersonalized
     - true
   * - enableCodelens
     - true

Book Questions
--------------

Book questions get ``question_json`` too. While loading a book's
``runestone-manifest.xml``, ``components/rsptx/build_tools/question_json.py``
converts the HTML of each question of a supported type (all those above except
``iframe``; PreTeXt calls a poll a *query*) into the shape above. A conversion
records anything the schema can't represent, such as a fill-in blank with
feedback for specific wrong answers. Because the assignment builder
regenerates a question's HTML from its ``question_json`` when the question is
copied or edited, the build stores only a lossless conversion and sets
``question_json`` to NULL otherwise.

Hints, solutions, and an introduction or conclusion that PreTeXt puts beside
a question belong to the book, not the question, so they are not part of
``question_json`` and don't prevent storing it.

Implementation Notes
--------------------

1. Storage format: ``question_json`` is stored as a JSON-encoded string on the
   ``Exercise`` record. ``buildQuestionJson()`` serializes via ``JSON.stringify()``
   and only includes fields relevant to the given ``question_type``.
2. Type-conditional inclusion: ``buildQuestionJson()`` uses spread-with-conditional
   patterns (``...(type === "x" && { ... })``), so irrelevant fields for a
   question type are never included in serialized JSON.
