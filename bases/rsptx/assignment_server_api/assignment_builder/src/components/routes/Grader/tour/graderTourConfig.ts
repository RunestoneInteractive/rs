import { Alignment, Side } from "driver.js";

export type TourRoute = "assignments" | "questions" | "answers" | "student";

export interface TourStepConfig {

  element: string;
  title: string;
  description: string;
  side: Side;
  align: Alignment;

  route: TourRoute;

  openDialog?: boolean;
}

export const GRADER_TOUR_STEPS: TourStepConfig[] = [
  {
    route: "assignments",
    element: '[data-tour="grader-title"]',
    title: "Welcome to the Grader",
    description:
      "This quick tour walks through every feature. We've loaded a demo course so you can see each view — even if your real course is empty.",
    side: "bottom",
    align: "start"
  },
  {
    route: "assignments",
    element: '[data-tour="grader-shortcuts-btn"]',
    title: "Keyboard shortcuts",
    description:
      "Power-users: open the cheatsheet at any time, or just hit ? on the keyboard. J / K (or ↑ / ↓) walk through students and roll over to the neighbouring question when you hit the end of the list.",
    side: "left",
    align: "start"
  },
  {
    route: "assignments",
    element: '[data-tour="grader-take-tour-btn"]',
    title: "Tour button",
    description:
      "You can re-open this tour at any time with the 'Take tour' button in the top-right corner.",
    side: "left",
    align: "start"
  },
  {
    route: "assignments",
    element: '[data-tour="grader-breadcrumb"]',
    title: "Breadcrumbs",
    description:
      "The breadcrumb always reflects where you are. Inside a question it also shows a graded/total chip so you can see your progress at a glance.",
    side: "bottom",
    align: "start"
  },
  {
    route: "assignments",
    element: '[data-tour="grader-assignment-picker"]',
    title: "Pick an assignment",
    description:
      "Every assignment in the course is listed as a card with its due date and total points. Click a card to drill in.",
    side: "top",
    align: "start"
  },
  {
    route: "assignments",
    element: '[data-tour="grader-assignment-card"]',
    title: "Assignment card",
    description:
      "Each card shows the name, a short description, due date and total points. Clicking opens that assignment's question list.",
    side: "right",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-question-grid"]',
    title: "Questions overview",
    description:
      "A grid of every gradable question in the assignment. The demo course includes one of every supported type so you can see the colour coding.",
    side: "bottom",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-question-card"]',
    title: "Question card",
    description:
      "Each card shows the question name, a colour-coded type tag, and four aggregated metrics.",
    side: "right",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-q-answered"]',
    title: "Answered — number of students",
    description:
      "How many students submitted at least one attempt. For ActiveCode this also includes students who only ran the code, so the card matches what you'll see on the per-question screen.",
    side: "right",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-q-correct"]',
    title: "Fully correct / fully scored — depends on type",
    description:
      "Students whose LAST attempt is a complete solution. The label changes with the question type:\n• Auto-graded (mchoice, activecode, codelens, webwork, splice, …): `correct = TRUE` (or `percent ≥ 1`) on the latest answer → shown as 'fully correct'.\n• Manually graded (shortanswer, parsons with `autograde=manual`, …): the instructor's score in `question_grades` equals the question's max points → shown as 'fully scored'.\n• Partial-credit types (dragndrop, clickablearea, matching, fillintheblank, parsons): we instead show 'avg. credit' — see the next step.",
    side: "right",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-q-average"]',
    title: "Average score — based on the gradebook",
    description:
      "Mean of `question_grades.score` across students who already have a graded row.",
    side: "right",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-q-percent"]',
    title: "% correct or % credit — depends on type",
    description:
      "For binary types this is `correct / answered` — the share of students whose last attempt is fully correct.\nFor partial-credit types (dragndrop, clickablearea, matching, fillintheblank, parsons) we switch to '% credit', which is the average `percent` (0–100%) over the LATEST attempt of every student. This is honest about partially-correct answers — '50% credit' on Drag-and-drop means the class on average got half the items right, not zero.",
    side: "left",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-q-progress"]',
    title: "Progress bar — average / max points",
    description:
      "Visual ratio of `average score / max points` for the question. Empty bar means nobody is graded yet; a full bar means the average submission already earned the maximum.",
    side: "bottom",
    align: "start"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-split-pane"]',
    title: "Unified grading view",
    description:
      "Everything you need on one screen: student list on the left, the submission preview in the middle, the grade panel on the right.",
    side: "top",
    align: "start"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-student-sidebar"]',
    title: "Student sidebar",
    description:
      "All students who attempted the question. Coloured icons show progress: green ✓ already graded, blue ⚡ auto-graded, grey ◯ pending. Filter, search, or hit H to hide already-graded students.",
    side: "right",
    align: "start"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-preview-pane"]',
    title: "Answer preview",
    description:
      "The question is rendered exactly as the student saw it. Different question types get specialised renderers (MCQ, Parsons, ActiveCode, Fill-in-the-blank, etc.).",
    side: "right",
    align: "start"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-history"]',
    title: "Attempt history",
    description:
      "Every submission is recorded chronologically. Drag the slider to replay an earlier attempt right inside the preview pane.",
    side: "bottom",
    align: "start"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-grade-panel"]',
    title: "Grade panel",
    description:
      "Score and comment for the active student. Changes are auto-saved when you tab out of a field — watch the small status pill in the top-right.",
    side: "left",
    align: "start"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-points-input"]',
    title: "Award points",
    description:
      "Enter the score (clamped to the maximum). Press G anywhere to jump back to this field.",
    side: "left",
    align: "start"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-comment-input"]',
    title: "Leave feedback",
    description:
      "Add a short comment the student will see on their results page.",
    side: "left",
    align: "start"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-next"]',
    title: "Manual prev / next",
    description:
      "Walk through students with the Prev / Next buttons (or J / K on the keyboard). When you reach the last student in a question, Next rolls over to the first ungraded student of the next question; Prev does the same backwards. Changes are auto-saved as you type — there is no save button.",
    side: "left",
    align: "end"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-auto-advance"]',
    title: "Auto-advance after save",
    description:
      "Flip this switch to keep your hands on the keyboard. Once a student's grade is auto-saved (and you stop editing for a moment), the Grader jumps to the next ungraded student automatically — perfect for long batches. A short Undo toast lets you roll back the move and the save if you change your mind.",
    side: "left",
    align: "end"
  }
];
