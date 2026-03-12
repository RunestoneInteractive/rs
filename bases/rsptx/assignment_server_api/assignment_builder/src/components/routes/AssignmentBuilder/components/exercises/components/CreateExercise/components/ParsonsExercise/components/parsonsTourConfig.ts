import { Side, Alignment } from "driver.js";

export interface TourStepConfig {
  element: string;
  title: string;
  description: string;
  side: Side;
  align: Alignment;
}

export const PARSONS_TOUR_STEPS: TourStepConfig[] = [
  /* 1 — Simple Mode */
  {
    element: '[data-tour="mode-switcher"]',
    title: "Simple Mode",
    description:
      "Simple Mode provides a streamlined interface with the most common options. Blocks show inline distractor toggles, quick alternative, and explanation buttons.",
    side: "bottom",
    align: "start"
  },

  /* 2 — Enhanced Mode */
  {
    element: '[data-tour="mode-switcher"]',
    title: "Enhanced Mode",
    description:
      "Enhanced Mode unlocks the full power of the Parsons constructor: Grader selection, custom ordering, line-number placement, and no-indent control. Block options are accessed via a popover menu.",
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
    title: "Block Ordering",
    description:
      "Control how blocks are presented to students. <strong>Random</strong> shuffles blocks each attempt. <strong>Custom</strong> lets you set a specific display position for each block.",
    side: "bottom",
    align: "start"
  },

  /* 5 — Line Numbers */
  {
    element: '[data-tour="line-numbers-section"]',
    title: "Line Numbers",
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

  /* 7 — No Indent */
  {
    element: '[data-tour="toggles-section"] label[for="noindent-opt"]',
    title: "No Indent",
    description:
      "When enabled, students cannot indent blocks. This is useful for exercises where indentation is not part of the solution (e.g., natural-language ordering).",
    side: "top",
    align: "start"
  },

  /* 8 — Add Block */
  {
    element: '[data-tour="add-block-btn"]',
    title: "Add Block",
    description:
      "Click this button to append a new empty code block to the workspace. Each block represents one logical line or group of lines in the exercise.",
    side: "bottom",
    align: "end"
  },

  /* 9 — Delete Block */
  {
    element: '[data-tour="first-block"] [aria-label="Remove block"]',
    title: "Delete Block",
    description:
      "Click the trash icon to remove a block. If the block is part of an alternative group with only two members, the group is dissolved automatically.",
    side: "left",
    align: "start"
  },

  /* 10 — Drag Handle */
  {
    element: '[data-tour="drag-handle"]',
    title: "Move Blocks",
    description:
      "Press and hold the drag handle (≡) to reorder blocks via drag-and-drop. Dragging horizontally adjusts indentation level. Visual guides highlight the target indent column.",
    side: "right",
    align: "start"
  },

  /* 11 — Split Block */
  {
    element: '[data-tour="first-block"]',
    title: "Split a Block",
    description:
      "Hover over a multi-line block to reveal a split indicator between lines. Click the <strong>+</strong> button on the divider to split the block into two separate blocks at that line.",
    side: "bottom",
    align: "start"
  },

  /* 12 — Solution & Distractor */
  {
    element: '[data-tour="distractor-pill"]',
    title: "Solution & Distractor",
    description:
      "Toggle a block between <strong>Solution</strong> and <strong>Distractor</strong>. Solution blocks form the correct answer. Distractor blocks are decoys that should not appear in the final solution.",
    side: "left",
    align: "start"
  },

  /* 13 — Block Options Button (Enhanced mode) */
  {
    element: '[data-tour="first-block"] [aria-label="Block options"]',
    title: "Block Options",
    description:
      "In Enhanced Mode, click the <strong>⋮</strong> button to open a dropdown with advanced block settings: <strong>Block Type</strong> (Solution / Distractor), <strong>Paired</strong> toggle, <strong>DAG Configuration</strong> (Tag & DependsOn), <strong>Display Order</strong>, <strong>Add Alternative</strong>, and <strong>Add Explanation</strong>.",
    side: "left",
    align: "start"
  }
];
