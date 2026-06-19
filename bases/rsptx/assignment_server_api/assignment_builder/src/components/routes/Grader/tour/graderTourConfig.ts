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
    title: "Welcome to the assignment grader",
    description:
      "This quick tour walks through every feature. We've loaded a demo course so you can see each view, even if your real course is empty.",
    side: "bottom",
    align: "start"
  },
  {
    route: "assignments",
    element: '[data-tour="grader-shortcuts-btn"]',
    title: "Keyboard shortcuts",
    description:
      "Open this cheatsheet any time by pressing ?. J / K (or ↑ / ↓) move through students and roll over to the next question at the end of the list.",
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
      "A grid of every gradable question in the assignment. The demo course includes one of every supported type so you can see the color coding.",
    side: "bottom",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-question-card"]',
    title: "Question card",
    description:
      "Each card shows the question name, a color-coded type tag, and four aggregated metrics.",
    side: "right",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-q-answered"]',
    title: "Answered",
    description:
      "How many students submitted at least one attempt. For ActiveCode this also includes students who only ran the code, so the card matches what you'll see on the per-question screen.",
    side: "right",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-q-correct"]',
    title: "Fully correct or fully scored",
    description:
      "Students whose last attempt is a complete solution. The label changes with the question type:\n• Auto-graded types (multiple choice, ActiveCode, CodeLens, WebWork, …) show 'fully correct': answers the system marked fully correct.\n• Manually graded types (short answer, manual Parsons, …) show 'fully scored': students whose recorded score equals the question's maximum points.\n• Partial-credit types (drag and drop, clickable areas, matching, fill in the blank, Parsons) show 'avg. credit' instead; see the next step.",
    side: "right",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-q-average"]',
    title: "Average score",
    description: "The mean recorded score across students who already have a grade.",
    side: "right",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-q-percent"]',
    title: "% correct or % credit",
    description:
      "For binary types this is the share of students whose last attempt is fully correct.\nFor partial-credit types (drag and drop, clickable areas, matching, fill in the blank, Parsons) it switches to '% credit': the average credit (0–100%) over each student's latest attempt. '50% credit' on drag and drop means the class on average got half the items right, not zero.",
    side: "left",
    align: "start"
  },
  {
    route: "questions",
    element: '[data-tour="grader-q-progress"]',
    title: "Progress bar",
    description:
      "The ratio of the average score to the question's maximum points. An empty bar means nobody is graded yet; a full bar means the average submission already earned the maximum.",
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
      "All students who attempted the question. Status icons show progress: ✓ graded, ⚡ auto-graded, ◐ in progress, ○ pending, – no submission. Filter, search, or press H to hide already-graded students.",
    side: "right",
    align: "start"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-preview-pane"]',
    title: "Answer preview",
    description:
      "The question is rendered exactly as the student saw it. Different question types get specialized renderers (MCQ, Parsons, ActiveCode, fill in the blank, and more).",
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
      "Score and comment for the active student. Changes are auto-saved when you tab out of a field; watch the small status pill in the top-right.",
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
    description: "Add a short comment the student will see on their results page.",
    side: "left",
    align: "start"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-next"]',
    title: "Previous and next",
    description:
      "Walk through students with the Previous / Next buttons (or J / K on the keyboard). When you reach the last student in a question, Next rolls over to the first ungraded student of the next question; Previous does the same backwards. Changes are auto-saved as you type, so there is no save button.",
    side: "left",
    align: "end"
  },
  {
    route: "student",
    openDialog: true,
    element: '[data-tour="grader-auto-advance"]',
    title: "Auto-advance after save",
    description:
      "Flip this switch to keep your hands on the keyboard. Once a student's grade is auto-saved (and you stop editing for a moment), the grader jumps to the next ungraded student automatically, which is useful for long grading batches. A short Undo toast lets you roll back the move and the save if you change your mind.",
    side: "left",
    align: "end"
  }
];
