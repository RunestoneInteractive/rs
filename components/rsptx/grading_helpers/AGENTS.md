# grading_helpers — agent guide

This package turns student submissions into grades. Two paths write grades and must
agree on every rule below:

- **Real-time:** `core.grade_submission`, called by the book server
  (`bases/rsptx/book_server_api/routers/rslogging.py`) on every logged answer, and
  `core.score_reading_page` for reading assignments.
- **Batch:** `regrade.py`, run when an instructor regrades an assignment.

| Module | Role |
|---|---|
| `core.py` | Real-time grading; `compute_total_score` recomputes the assignment total |
| `regrade.py` | Batch regrade; has its own first/last/best-answer selection |
| `scoring.py` | Scoring formulas (`score_answer_values`), shared by both paths |
| `comments.py` | Policy for `question_grades.comment`: autograded vs. hand-graded |
| `select_questions.py` | Resolving a `selectquestion` to the question a student was served |
| `answer_tables.py` | Question type → answer table (videos and polls have none) |
| `lti_push.py` | Sending totals to an LMS over LTI 1.1 / 1.3 |

## How a submission is graded

1. The book server writes the `useinfo` row and the answer-table row (e.g.
   `mchoice_answers`), **each committed before grading starts**.
2. `is_assigned` decides whether the question counts. Released assignments that are
   past due don't; deadline exceptions (accommodations) extend the due date.
3. The branch for the question's `which_to_grade` (`first_answer`, `last_answer`,
   `best_answer`, `all_answer`) creates or updates the student's `question_grades` row.
4. `compute_total_score` recomputes the `grades` row for the assignment and pushes it
   to the LMS.

## Invariants

- **The current answer is already in the answer table.** "Has the student answered
  yet?" can't be asked of the answer table, because it always finds the answer being
  graded. Ask whether a `question_grades` row exists instead.
- **One `question_grades` row per (student, course, `div_id`), shared by every
  assignment.** Unique index on `(div_id, course_name, sid)`; there is no assignment
  column. A score earned in one assignment is visible in every assignment that uses the
  same question, possibly at a different point value. That's why `best_answer` replaces
  a stored score above this assignment's maximum.
- **Selectquestions are split.** The *answer* is stored under the served question's
  `div_id`; the *grade* is stored under the wrapper's (`submission.selector_id`). In
  `grade_submission`, `div_id` is the grade key and `submission.div_id` is the question
  being scored. Every lookup, update and create for a grade row must use the same key.
- **Never overwrite a hand-entered grade.** Before writing, check the existing row
  with `comments.is_hand_graded(comment)`. The autograder writes the comment
  `"autograded"` and may only replace rows it wrote.
- **Real-time and batch must agree.** A change to how a question is scored or which
  answer counts has to be made in both `core.py` and `regrade.py`. Put formulas in
  `scoring.py` so both paths share them.
- **Videos and polls have no answer table.** Their `useinfo` interaction row is the
  submission (`INTERACTION_ONLY_EVENTS`); don't call `fetch_answers` for them.
- **Recompute the total after changing a question grade.** Call
  `compute_total_score`. It runs on every scored answer, the hottest path in the
  system, so never add blocking I/O to it: LTI 1.1 pushes go through a debounced
  background task for that reason.

## Trap: grade-key mistakes are silent

`create_question_grade_entry` catches `IntegrityError`, logs it, and returns `None`.
If a branch looks up a grade under one key and creates it under another, the first
save inserts a row nobody finds, and every later save fails into the log. The student
just stops getting credit. An occasional
`IntegrityError ... called from grade_submission` in the logs means a key mismatch,
not a database problem.

## Tests

`test/components/rsptx/grading_helpers/test_core.py` covers `grade_submission` with
the database mocked out; `_patch_scoring(existing_grade, score_spec)` patches
everything around the grade row. Add a test there for any change to a
`which_to_grade` branch, including the selectquestion case (`selector_id` set).
Check the live path too: rebuild the book server (`uv run build -s book dev`), submit
an answer, and look at `question_grades`.
