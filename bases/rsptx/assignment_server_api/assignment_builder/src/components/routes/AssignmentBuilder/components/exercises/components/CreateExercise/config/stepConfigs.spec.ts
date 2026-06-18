import {
  CLICKABLE_AREA_STEP_VALIDATORS,
  DRAG_AND_DROP_STEP_VALIDATORS,
  PARSONS_STEP_VALIDATORS,
  POLL_STEP_VALIDATORS,
  getStepConfig
} from "./stepConfigs";

describe("getStepConfig parsonsprob", () => {
  const parsonsStepLabels = ["Language", "Instructions", "Code blocks", "Settings", "Preview"];

  it("has exactly one config entry per editor step", () => {
    parsonsStepLabels.forEach((_, index) => {
      expect(getStepConfig("parsonsprob", index)).toBeDefined();
    });
    expect(getStepConfig("parsonsprob", parsonsStepLabels.length)).toBeUndefined();
  });

  it("titles the settings step as settings and the last step as preview", () => {
    expect(getStepConfig("parsonsprob", 3)?.title).toBe("Exercise settings");
    expect(getStepConfig("parsonsprob", 4)?.title).toBe("Preview");
  });

  it("aligns every step config with its validator index", () => {
    expect(PARSONS_STEP_VALIDATORS).toHaveLength(parsonsStepLabels.length);
  });
});

describe("POLL_STEP_VALIDATORS scale options step", () => {
  const optionsStepIndex = 2;
  const validateOptionsStep = POLL_STEP_VALIDATORS[optionsStepIndex];

  const scalePoll = (overrides: Record<string, unknown>) => ({
    poll_type: "scale",
    ...overrides
  });

  it("accepts a scale poll with both bounds and min below max", () => {
    expect(validateOptionsStep(scalePoll({ scale_min: 1, scale_max: 5 }))).toEqual([]);
  });

  it("rejects a scale poll missing only the maximum bound", () => {
    expect(validateOptionsStep(scalePoll({ scale_min: 1 }))).not.toEqual([]);
  });

  it("rejects a scale poll missing only the minimum bound", () => {
    expect(validateOptionsStep(scalePoll({ scale_max: 5 }))).not.toEqual([]);
  });

  it("rejects a scale poll whose minimum is not below its maximum", () => {
    expect(validateOptionsStep(scalePoll({ scale_min: 5, scale_max: 5 }))).not.toEqual([]);
    expect(validateOptionsStep(scalePoll({ scale_min: 7, scale_max: 3 }))).not.toEqual([]);
  });

  it("still requires two filled options for an options poll", () => {
    expect(
      validateOptionsStep({ poll_type: "options", optionList: [{ choice: "Only one" }] })
    ).not.toEqual([]);
    expect(
      validateOptionsStep({
        poll_type: "options",
        optionList: [{ choice: "A" }, { choice: "B" }]
      })
    ).toEqual([]);
  });
});

describe("DRAG_AND_DROP_STEP_VALIDATORS content step", () => {
  const contentStepIndex = 1;
  const validateContentStep = DRAG_AND_DROP_STEP_VALIDATORS[contentStepIndex];
  const contentData = (data: object) =>
    data as Parameters<(typeof DRAG_AND_DROP_STEP_VALIDATORS)[number]>[0];
  const filledColumns = {
    left: [{ id: "l1", label: "Apple" }],
    right: [{ id: "r1", label: "Red fruit" }]
  };

  it("requires items in both columns", () => {
    expect(validateContentStep(contentData({ left: [], right: [], correctAnswers: [] }))).toContain(
      "Add at least one item in each column"
    );
  });

  it("requires at least one connection", () => {
    expect(validateContentStep(contentData({ ...filledColumns, correctAnswers: [] }))).toContain(
      "Add at least one connection between a source item and a target match"
    );
  });

  it("passes with filled items and one connection", () => {
    expect(
      validateContentStep(contentData({ ...filledColumns, correctAnswers: [["l1", "r1"]] }))
    ).toHaveLength(0);
  });
});

describe("CLICKABLE_AREA_STEP_VALIDATORS content step", () => {
  const validateContentStep = CLICKABLE_AREA_STEP_VALIDATORS[0];
  const statement = "<p>Pick the correct lines.</p>";

  it("requires content before mark checks", () => {
    expect(validateContentStep({ statement, questionText: "" })).toEqual(["Content is required"]);
  });

  it("requires one correct and one incorrect marked area", () => {
    const errors = validateContentStep({ statement, questionText: "<p>plain text</p>" });

    expect(errors).toContain("Mark at least one correct area");
    expect(errors).toContain("Mark at least one incorrect area");
  });

  it("passes once both mark kinds exist", () => {
    const marked =
      '<p><span data-correct="true">a</span><span data-incorrect="true">b</span></p>';

    expect(validateContentStep({ statement, questionText: marked })).toHaveLength(0);
  });
});
