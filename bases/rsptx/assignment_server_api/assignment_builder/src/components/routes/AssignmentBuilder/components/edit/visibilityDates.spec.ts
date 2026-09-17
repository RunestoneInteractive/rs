import {
  adjustDatesForHiddenOnChange,
  adjustDatesForVisibleOnChange,
  applyModeDateDefaults
} from "./visibilityDates";

describe("applyModeDateDefaults", () => {
  it("keeps both dates untouched for the visible and hidden modes", () => {
    expect(applyModeDateDefaults("visible", null, null)).toEqual({
      visibleOn: null,
      hiddenOn: null
    });
    expect(applyModeDateDefaults("hidden", "2026-06-20T00:00:00", "2026-06-21T23:59:00")).toEqual({
      visibleOn: "2026-06-20T00:00:00",
      hiddenOn: "2026-06-21T23:59:00"
    });
  });

  it("defaults a missing visible_on for scheduled_visible", () => {
    const result = applyModeDateDefaults("scheduled_visible", null, null);

    expect(result.visibleOn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(result.hiddenOn).toBeNull();
  });

  it("defaults a missing hidden_on for scheduled_hidden", () => {
    const result = applyModeDateDefaults("scheduled_hidden", null, null);

    expect(result.visibleOn).toBeNull();
    expect(result.hiddenOn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("defaults both missing dates for scheduled_period", () => {
    const result = applyModeDateDefaults("scheduled_period", null, null);

    expect(result.visibleOn).not.toBeNull();
    expect(result.hiddenOn).not.toBeNull();
  });

  it("preserves already-set dates for scheduled modes", () => {
    expect(
      applyModeDateDefaults("scheduled_period", "2026-06-20T00:00:00", "2026-06-21T23:59:00")
    ).toEqual({ visibleOn: "2026-06-20T00:00:00", hiddenOn: "2026-06-21T23:59:00" });
  });
});

describe("adjustDatesForVisibleOnChange", () => {
  it("pushes hidden_on one day past a visible_on that crosses it in scheduled_period", () => {
    const result = adjustDatesForVisibleOnChange(
      "scheduled_period",
      "2026-06-22T00:00:00",
      "2026-06-21T23:59:00"
    );

    expect(result.visibleOn).toBe("2026-06-22T00:00:00");
    expect(result.hiddenOn).toBe("2026-06-23T00:00:00");
  });

  it("keeps hidden_on when the new visible_on stays before it", () => {
    const result = adjustDatesForVisibleOnChange(
      "scheduled_period",
      "2026-06-20T00:00:00",
      "2026-06-21T23:59:00"
    );

    expect(result.hiddenOn).toBe("2026-06-21T23:59:00");
  });

  it("does not adjust outside scheduled_period", () => {
    const result = adjustDatesForVisibleOnChange(
      "scheduled_visible",
      "2026-06-22T00:00:00",
      "2026-06-21T23:59:00"
    );

    expect(result).toEqual({ visibleOn: "2026-06-22T00:00:00", hiddenOn: "2026-06-21T23:59:00" });
  });
});

describe("adjustDatesForHiddenOnChange", () => {
  it("pulls visible_on one day before a hidden_on that crosses it in scheduled_period", () => {
    const result = adjustDatesForHiddenOnChange(
      "scheduled_period",
      "2026-06-20T12:00:00",
      "2026-06-19T00:00:00"
    );

    expect(result.hiddenOn).toBe("2026-06-19T00:00:00");
    expect(result.visibleOn).toBe("2026-06-18T00:00:00");
  });

  it("keeps visible_on when the new hidden_on stays after it", () => {
    const result = adjustDatesForHiddenOnChange(
      "scheduled_period",
      "2026-06-20T00:00:00",
      "2026-06-21T23:59:00"
    );

    expect(result.visibleOn).toBe("2026-06-20T00:00:00");
  });

  it("does not adjust outside scheduled_period", () => {
    const result = adjustDatesForHiddenOnChange(
      "scheduled_hidden",
      "2026-06-20T12:00:00",
      "2026-06-19T00:00:00"
    );

    expect(result).toEqual({ visibleOn: "2026-06-20T12:00:00", hiddenOn: "2026-06-19T00:00:00" });
  });
});
