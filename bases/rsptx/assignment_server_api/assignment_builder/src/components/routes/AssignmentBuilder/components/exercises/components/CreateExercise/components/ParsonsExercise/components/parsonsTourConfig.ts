import { Side, Alignment } from "driver.js";

export interface TourStepConfig {
  element: string;
  title: string;
  description: string;
  side: Side;
  align: Alignment;
}

export const PARSONS_TOUR_STEPS: TourStepConfig[] = [
  /* 1 — Simple mode */
  {
    element: '[data-tour="mode-switcher"]',
    title: "Simple mode",
    description:
      "Simple mode provides a streamlined interface with the most common options. Blocks show inline distractor toggles, quick alternative, and explanation buttons.",
    side: "bottom",
    align: "start"
  },

  /* 2 — Enhanced mode */
  {
    element: '[data-tour="mode-switcher"]',
    title: "Enhanced mode",
    description:
      "Enhanced mode adds grader selection, custom ordering, line-number placement, and no-indent control. Block options are accessed via a popover menu.",
    side: "bottom",
    align: "start"
  },

  /* 3 — Grader */
  {
    element: '[data-tour="grader-section"]',
    title: "Grader",
    description:
      "Choose how student answers are evaluated. <strong>Line-based</strong> checks exact line order. <strong>DAG</strong> (Directed Acyclic Graph) allows multiple valid orderings by defining dependencies between blocks.",
    side: "bottom",
    align: "start"
  },

  /* 4 — Ordering */
  {
    element: '[data-tour="order-section"]',
    title: "Block ordering",
    description:
      "Control how blocks are presented to students. <strong>Random</strong> shuffles blocks each attempt. <strong>Custom</strong> lets you set a specific display position for each block.",
    side: "bottom",
    align: "start"
  },

  /* 5 — Line numbers */
  {
    element: '[data-tour="line-numbers-section"]',
    title: "Line numbers",
    description:
      "Use this dropdown to display line numbers on the <strong>Left</strong>, <strong>Right</strong>, or hide them entirely (<strong>None</strong>). Line numbers help students reference specific lines in their solution.",
    side: "bottom",
    align: "start"
  },

  /* 6 — Toggles (Adaptive + No-indent) */
  {
    element: '[data-tour="toggles-section"]',
    title: "Toggles",
    description:
      "<strong>Adaptive</strong> enables progressive feedback — students receive incremental hints.",
    side: "bottom",
    align: "start"
  },

  /* 7 — No indent */
  {
    element: '[data-tour="toggles-section"] label[for="noindent-opt"]',
    title: "No indent",
    description:
      "When enabled, students cannot indent blocks. This is useful for exercises where indentation is not part of the solution (e.g., natural-language ordering).",
    side: "top",
    align: "start"
  },

  /* 8 — Add block */
  {
    element: '[data-tour="add-block-btn"]',
    title: "Add block",
    description:
      "Click this button to append a new empty code block to the workspace. Each block represents one logical line or group of lines in the exercise.",
    side: "bottom",
    align: "end"
  },

  /* 9 — Remove block */
  {
    element: '[data-tour="first-block"] [aria-label="Remove block"]',
    title: "Remove block",
    description:
      "Click the trash icon to remove a block. If the block is part of an alternative group with only two members, the group is dissolved automatically.",
    side: "left",
    align: "start"
  },

  /* 10 — Drag handle */
  {
    element: '[data-tour="drag-handle"]',
    title: "Move blocks",
    description:
      "Press and hold the drag handle (≡) to reorder blocks via drag-and-drop. Dragging horizontally adjusts indentation level. Visual guides highlight the target indent column.",
    side: "right",
    align: "start"
  },

  /* 11 — Split block */
  {
    element: '[data-tour="first-block"]',
    title: "Split a block",
    description:
      "Hover over a multi-line block to reveal a split indicator between lines. Click the <strong>+</strong> button on the divider to split the block into two separate blocks at that line.",
    side: "bottom",
    align: "start"
  },

  /* 12 — Solution & distractor */
  {
    element: '[data-tour="distractor-pill"]',
    title: "Solution & distractor",
    description:
      "Toggle a block between <strong>Solution</strong> and <strong>Distractor</strong>. Solution blocks form the correct answer. Distractor blocks are decoys that should not appear in the final solution.",
    side: "left",
    align: "start"
  },

  /* 13 — Block options button (enhanced mode) */
  {
    element: '[data-tour="first-block"] [aria-label="Block options"]',
    title: "Block options",
    description:
      "In enhanced mode, click the <strong>⋮</strong> button to open a dropdown with advanced block settings: <strong>Block type</strong> (Solution / Distractor), <strong>Paired</strong> toggle, <strong>DAG configuration</strong> (Tag & Depends on), <strong>Display order</strong>, <strong>Add alternative</strong>, and <strong>Add explanation</strong>.",
    side: "left",
    align: "start"
  },

  /* 14 — Fullscreen */
  {
    element: '[data-tour="fullscreen-btn"]',
    title: "Fullscreen mode",
    description:
      "Click this button to enter <strong>fullscreen</strong> mode. It gives you more screen space to work with blocks comfortably, especially for larger exercises.",
    side: "bottom",
    align: "end"
  }
];
