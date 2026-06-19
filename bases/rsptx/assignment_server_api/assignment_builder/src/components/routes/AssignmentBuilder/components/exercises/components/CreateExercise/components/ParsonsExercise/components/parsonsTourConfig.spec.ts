import { PARSONS_TOUR_STEPS } from "./parsonsTourConfig";

describe("PARSONS_TOUR_STEPS copy", () => {
  it("keeps the remove-block step aligned with the button aria-label", () => {
    const removeStep = PARSONS_TOUR_STEPS.find((step) =>
      step.element.includes('[aria-label="Remove block"]')
    );

    expect(removeStep).toBeDefined();
    expect(removeStep?.title).toBe("Remove block");
    expect(removeStep?.title).not.toMatch(/delete/i);
  });

  it("describes enhanced mode by its concrete capabilities", () => {
    const enhancedStep = PARSONS_TOUR_STEPS.find((step) => step.title === "Enhanced mode");

    expect(enhancedStep?.description).toContain(
      "adds grader selection, custom ordering, line-number placement, and no-indent control"
    );
    expect(enhancedStep?.description).not.toMatch(/unlocks the full power/i);
  });

  it("uses sentence case for every title", () => {
    for (const step of PARSONS_TOUR_STEPS) {
      const words = step.title.split(" ").slice(1);
      const titleCasedTail = words.filter(
        (word) => /^[A-Z][a-z]/.test(word) && !["DAG", "Parsons"].includes(word)
      );

      expect(titleCasedTail).toEqual([]);
    }
  });

  it("anchors the add-block step to the add-block button", () => {
    const addStep = PARSONS_TOUR_STEPS.find((step) => step.title === "Add block");

    expect(addStep?.element).toBe('[data-tour="add-block-btn"]');
  });
});
