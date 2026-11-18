Parsons Answer Format
=====================

Purpose
-------

This page explains how to turn a row of the ``parsons_answers`` table back into
the blocks the student saw. The result is plain text in the student's order and
with the student's indentation. It covers the storage format, how the line
numbers in that format map to the problem source, and gives a reference
JavaScript decoder.

Source of Truth
---------------

.. list-table::
   :header-rows: 1

   * - File
     - Role
   * - bases/rsptx/interactives/runestone/parsons/js/parsons.js
     - ``initializeLines`` (builds the line table), ``answerHash`` / ``sourceHash``
       (encode), ``blockFromHash`` / ``blocksFromHash`` (decode),
       ``logCurrentAnswer`` (what is sent to the server)
   * - bases/rsptx/interactives/runestone/parsons/js/parsonsBlock.js
     - ``ParsonsBlock.hash()`` (per-block encoding), constructor (per-line display indent)
   * - bases/rsptx/interactives/runestone/parsons/js/parsonsLine.js
     - ``ParsonsLine`` constructor (line ``index``, ``text``, raw ``indent``)
   * - components/rsptx/db/models.py
     - ``ParsonsAnswers``: the ``answer`` and ``source`` columns

If the decoder below and ``parsons.js`` ever disagree, ``parsons.js`` is right.
The decoder copies the behaviour of ``initializeLines``, quirks included.

What Is Stored
--------------

``logCurrentAnswer`` sends ``answer``, ``source`` and ``act``, and the server
saves them into ``parsons_answers``:

.. list-table::
   :header-rows: 1

   * - Column
     - Contents
   * - ``answer``
     - The blocks in the answer (right-hand) area, top to bottom
   * - ``source``
     - The blocks still in the source (left-hand) area, top to bottom
   * - ``correct`` / ``percent``
     - The grade

Both ``answer`` and ``source`` use the same encoding:

.. code-block:: text

   area   := "-"                      (the area is empty)
           | block ( "-" block )*
   block  := lineIndex ( "_" lineIndex )* "_" indent

* ``lineIndex`` is the position of a line in the problem's **line table**
  (see below). It starts at 0 and counts every line in the source, distractors
  included. It is not the number of a block.
* A block that holds several lines lists all of their indexes.
* The last number in each block is the **indent level the student gave the
  block**, counted in levels, not spaces. When the problem has
  ``data-noindent`` set, this number is always 0.

Example: ``0_0-1_2_3_1`` means two blocks. The first block is line 0 at
level 0. The second block holds lines 1, 2 and 3, and the student indented it
one level.

The ``adaptive`` part of the state (disabled distractors, a ``noindent``
override, the check count) is **not** saved in ``parsons_answers``. The
``ParsonsAnswers`` schema has no field for it. It survives only in the ``act``
string of the matching ``useinfo`` row:
``correct|<source>|<answer>|<adaptive>``. ``parsonsMove`` events in
``useinfo`` record the state after every move as
``<action>|<source>|<answer>[|<adaptive>]``, so those rows can be decoded the
same way to replay a student's work.

Getting the Problem Source
--------------------------

The line indexes refer to the text inside the problem's
``<pre class="parsonsblocks">`` element. On the server that is
``questions.htmlsrc`` (look the question up by ``name == div_id``). Read these
from it:

* the pre's **innerHTML**: the source text the component parses
* ``data-noindent``: whether indentation is fixed. If it is set, the stored
  indent is 0 and each line keeps its authored indent.
* ``data-language``: for ``natural``, ``math`` and ``text`` the lines are HTML
  (``<div class="para">…``, MathJax TeX), not code

Parse ``htmlsrc`` with a real HTML parser (``DOMParser`` or a detached
element) and read ``pre.innerHTML``. That is exactly what the component sees.

Building the Line Table
-----------------------

This copies ``Parsons.initializeLines`` (the normal path, not ``scaffolding``):

1. ``text = pre.innerHTML.trim()``
2. Split ``text`` on ``---`` to get the text blocks. If there is no ``---`` at
   all, split on ``\n`` instead, so every physical line becomes its own block.
3. For each text block:

   a. If it contains ``#paired:`` or ``#distractor:``, cut off everything after
      the tag (the help text).
   b. If it contains ``class="displaymath``, the whole block is **one line**
      and is not split on newlines.
   c. Remove ``#paired``, ``#distractor`` and ``#tag:…;…;`` together with the
      whitespace around them (``/\s*#(paired|distractor|tag:.*;.*;)\s*/g``).
   d. Split on ``\n``. Skip a blank row **only if it is the first or last row
      of the block**. A blank row anywhere else becomes a real, empty line and
      **takes up an index**. This catches people out: PreTeXt output puts
      ``\n\n`` after every ``---``, so most blocks after the first produce an
      empty line at the front of the block. Leave these lines in the table, or
      every later index will be off.
   e. For each line kept: strip trailing whitespace, then
      ``text = line without leading whitespace`` and
      ``rawIndent = number of leading whitespace characters``. Add it to the
      table. The ``index`` is its position in the table.

4. **Normalize indents.** Gather the distinct ``rawIndent`` values from all
   lines, sort them in ascending order, and replace each line's ``rawIndent``
   with its position in that list. With raw indents ``{0, 4, 8}``, the levels
   become ``{0, 1, 2}``. A tab counts as one character, the same as a space.

``data-order``, shuffling, and adaptive distractor removal all change which
blocks the student sees and in what order. They never change the line table,
so indexes stay stable.

Turning a Block Into Indented Lines
-----------------------------------

For each block in ``answer``:

* ``shared = min(indent of the block's lines)``
* each line's display level is:

  * normal: ``blockIndent + (line.indent - shared)``. The block keeps its
    internal shape, and the student's indent moves the whole block.
  * ``data-noindent``: ``line.indent``. The block cannot be moved sideways, so
    each line keeps its authored level.

* the output line is ``indentString.repeat(level) + text``

``text`` is HTML from innerHTML (``&lt;``, ``<div class="para">``,
``<span class="process-math">``). Run it through ``textContent`` to get plain
text, or keep the HTML if you plan to render it.

Worked Example
--------------

Source:

.. code-block:: text

   def main():
   ---
       x = 1
       if x:
           print(x)
   ---
       print("no") #distractor: not needed

Line table (the blank row right after each ``---`` is the block's first row,
so it is skipped):

.. list-table::
   :header-rows: 1

   * - index
     - text
     - raw indent
     - level
   * - 0
     - ``def main():``
     - 0
     - 0
   * - 1
     - ``x = 1``
     - 4
     - 1
   * - 2
     - ``if x:``
     - 4
     - 1
   * - 3
     - ``print(x)``
     - 8
     - 2
   * - 4
     - ``print("no")``
     - 4
     - 1

``answer = "0_0-1_2_3_1"`` and ``source = "4_0"``. The second block has
``shared = 1`` and ``blockIndent = 1``, so its lines get levels 1, 1 and 2:

.. code-block:: python

   def main():
       x = 1
       if x:
           print(x)

If the student had left that block at the left margin (``1_2_3_0``), ``x = 1``
would be at level 0 and ``print(x)`` at level 1.

Reference Decoder
-----------------

This decoder was checked against the real component in vitest/jsdom using 21
questions from a local database. In every case it produced the same line
table (text and level) as ``Parsons.lines``, and the same output as rendering
``Parsons.blocksFromHash(answer)``.

.. code-block:: javascript

   // Parse the innerHTML of <pre class="parsonsblocks"> into the same line
   // table that Parsons.initializeLines() builds.
   export function parseParsonsLines(blockSource) {
       const text = blockSource.trim();
       let textBlocks = text.split("---");
       if (textBlocks.length === 1) {
           textBlocks = text.split("\n");
       }
       const lines = [];
       const rawIndents = [];
       for (let textBlock of textBlocks) {
           let kind = "solution";
           let i = textBlock.indexOf("#paired:");
           if (i >= 0) {
               textBlock = textBlock.substring(0, i + 7);
           } else if ((i = textBlock.indexOf("#distractor:")) >= 0) {
               textBlock = textBlock.substring(0, i + 11);
           } else if (textBlock.includes("#tag:")) {
               textBlock = textBlock.replace(/#tag:.*;.*;/, (s) =>
                   s.replace(/\s+/g, ""),
               );
           }
           const displaymath = textBlock.includes('class="displaymath');
           textBlock = textBlock.replace(
               /\s*#(paired|distractor|tag:.*;.*;)\s*/g,
               (m, arg) => {
                   if (arg === "paired" || arg === "distractor") kind = arg;
                   return "";
               },
           );
           const split = displaymath ? [textBlock] : textBlock.split("\n");
           for (let j = 0; j < split.length; j++) {
               const code = split[j];
               // only a blank FIRST or LAST row is dropped; interior blank
               // rows become real (empty) lines and consume an index
               if (/^\s*$/.test(code) && (j === 0 || j === split.length - 1)) {
                   continue;
               }
               const trimmed = code.replace(/\s*$/, "");
               const lineText = trimmed.replace(/^\s*/, "");
               const indent = trimmed.length - lineText.length;
               lines.push({ index: lines.length, text: lineText, indent, kind });
               if (!rawIndents.includes(indent)) rawIndents.push(indent);
           }
       }
       rawIndents.sort((a, b) => a - b);
       for (const line of lines) line.indent = rawIndents.indexOf(line.indent);
       return lines;
   }

   // "-" or "i_i_..._indent-i_..._indent" -> [{lineIndexes, indent}]
   export function decodeParsonsAnswer(answer) {
       if (answer == null || answer === "" || answer === "-") return [];
       return answer.split("-").map((blockHash) => {
           const parts = blockHash.split("_").map(Number);
           return { lineIndexes: parts.slice(0, -1), indent: parts.at(-1) };
       });
   }

   function htmlToText(html) {
       const el = document.createElement("div");
       el.innerHTML = html;
       return el.textContent;
   }

   // blockSource: innerHTML of pre.parsonsblocks
   // noindent:    the pre's data-noindent value
   export function parsonsAnswerToText(
       blockSource,
       answer,
       { noindent = false, indentString = "    ", plainText = true } = {},
   ) {
       const lines = parseParsonsLines(blockSource);
       const out = [];
       for (const block of decodeParsonsAnswer(answer)) {
           const blockLines = block.lineIndexes.map((i) => lines[i]);
           if (blockLines.some((l) => l === undefined)) {
               throw new Error(`answer references unknown line in ${answer}`);
           }
           const shared = Math.min(...blockLines.map((l) => l.indent));
           for (const line of blockLines) {
               const level = noindent
                   ? line.indent
                   : block.indent + (line.indent - shared);
               const text = plainText ? htmlToText(line.text) : line.text;
               out.push(indentString.repeat(level) + text);
           }
       }
       return out.join("\n");
   }

Usage, starting from ``questions.htmlsrc``:

.. code-block:: javascript

   const doc = new DOMParser().parseFromString(htmlsrc, "text/html");
   const pre = doc.querySelector("pre.parsonsblocks");
   const noindent = pre.dataset.noindent === "true";
   const text = parsonsAnswerToText(pre.innerHTML, row.answer, { noindent });

Every line in the table carries a ``kind`` (``solution``, ``paired`` or
``distractor``). Use it to mark distractor lines the student placed in their
answer, for example by adding a ``# distractor`` comment.

Caveats
-------

* **The answer may be older than the source.** ``parsons_answers`` stores
  indexes, not text. If the book is rebuilt and a Parsons problem's blocks
  change, old answers can point at lines that no longer exist or now hold
  different text. ``PTXSB_2_number-theory-proof`` in the local database has
  this problem: its answer uses line 17, but the current source has 15 lines.
  The component falls back to a reset problem in that case. A decoder should
  report it clearly rather than crash; the reference decoder throws.
* **Adaptive problems** (``data-adaptive``) can turn indentation off for a
  student through the adaptive hash (``i``). That state is not in
  ``parsons_answers``. If the stored block indents look wrong for such a
  problem, check the ``useinfo`` ``act`` string.
* **Scaffolding / CodeTailor problems** (``data-scaffolding``) build their
  lines differently. ``#settled`` blocks add placeholder lines that take up
  indexes, every blank row is dropped, and indents of ``def``, ``class``,
  ``import`` and ``public class`` lines are forced to 0. The reference decoder
  does not cover this path.
* **Math and natural-language problems**: ``textContent`` returns the raw TeX
  (``\(n\equiv 0\mod 2\)``). A ``displaymath`` block is a single line that may
  contain newlines.
