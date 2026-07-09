import { GRADER_TOUR_STEPS } from "./graderTourConfig";

describe("GRADER_TOUR_STEPS copy", () => {
  it("never renders literal markdown backticks through driver.js", () => {
    for (const step of GRADER_TOUR_STEPS) {
      expect(step.title).not.toContain("`");
      expect(step.description).not.toContain("`");
    }
  });

  it("keeps database internals out of the descriptions", () => {
    const internals = /question_grades|correct = TRUE|percent ≥ 1|autograde=manual/;

    for (const step of GRADER_TOUR_STEPS) {
      expect(step.description).not.toMatch(internals);
    }
  });

  it("uses no em dashes in titles", () => {
    for (const step of GRADER_TOUR_STEPS) {
      expect(step.title).not.toContain("—");
    }
  });

  it("uses American spelling everywhere", () => {
    const british = /colour|neighbour|specialised|organis(e|ed|ing)/i;

    for (const step of GRADER_TOUR_STEPS) {
      expect(step.title).not.toMatch(british);
      expect(step.description).not.toMatch(british);
    }
  });

  it("describes the shortcuts cheatsheet without power-user filler", () => {
    const shortcutsStep = GRADER_TOUR_STEPS.find(
      (step) => step.element === '[data-tour="grader-shortcuts-btn"]'
    );

    expect(shortcutsStep?.description).toContain("pressing ?");
    expect(shortcutsStep?.description).toContain("J / K");
    expect(shortcutsStep?.description).not.toMatch(/power-user/i);
  });

  it("describes auto-advance without marketing filler", () => {
    const autoAdvanceStep = GRADER_TOUR_STEPS.find(
      (step) => step.element === '[data-tour="grader-auto-advance"]'
    );

    expect(autoAdvanceStep?.description).toContain("useful for long grading batches");
    expect(autoAdvanceStep?.description).not.toMatch(/perfect for/i);
  });

  it("lists all five sidebar status glyphs", () => {
    const sidebarStep = GRADER_TOUR_STEPS.find(
      (step) => step.element === '[data-tour="grader-student-sidebar"]'
    );

    for (const glyph of ["✓", "⚡", "◐", "○", "–"]) {
      expect(sidebarStep?.description).toContain(glyph);
    }
  });

  it("uses sentence case for every title", () => {
    const allowedCapitalized = ["K", "J", "Next", "Previous"];

    for (const step of GRADER_TOUR_STEPS) {
      const tail = step.title.split(" ").slice(1);
      const titleCasedTail = tail.filter(
        (word) => /^[A-Z][a-z]/.test(word) && !allowedCapitalized.includes(word)
      );

      expect(titleCasedTail).toEqual([]);
    }
  });

  it("anchors every step to a grader data-tour selector", () => {
    for (const step of GRADER_TOUR_STEPS) {
      expect(step.element).toMatch(/^\[data-tour="grader-[a-z-]+"\]$/);
    }
  });
});
