import { getVisibilityMode, getVisibilityValues } from "./visibilityMode";

describe("getVisibilityMode", () => {
  it("returns 'hidden' when not visible and no schedule dates", () => {
    expect(getVisibilityMode(false, null, null)).toBe("hidden");
  });

  it("returns 'visible' when visible and no hidden date", () => {
    expect(getVisibilityMode(true, null, null)).toBe("visible");
  });

  it("returns 'scheduled_visible' when not visible and only visible_on is set", () => {
    expect(getVisibilityMode(false, "2026-01-01T00:00:00Z", null)).toBe("scheduled_visible");
  });

  it("returns 'scheduled_hidden' when visible and hidden_on is set", () => {
    expect(getVisibilityMode(true, null, "2026-02-01T00:00:00Z")).toBe("scheduled_hidden");
  });

  it("returns 'scheduled_period' when not visible and both dates are set", () => {
    expect(getVisibilityMode(false, "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")).toBe(
      "scheduled_period"
    );
  });

  it("treats undefined visible as hidden", () => {
    expect(getVisibilityMode(undefined, null, null)).toBe("hidden");
  });

  it("prioritizes scheduled_hidden over plain visible when both visible and hidden_on set", () => {
    expect(getVisibilityMode(true, "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")).toBe(
      "scheduled_hidden"
    );
  });
});

describe("getVisibilityValues", () => {
  const V = "2026-01-01T00:00:00Z";
  const H = "2026-02-01T00:00:00Z";

  it("clears both dates and is not visible for 'hidden'", () => {
    expect(getVisibilityValues("hidden", V, H)).toEqual({
      visible: false,
      visible_on: null,
      hidden_on: null
    });
  });

  it("clears both dates and is visible for 'visible'", () => {
    expect(getVisibilityValues("visible", V, H)).toEqual({
      visible: true,
      visible_on: null,
      hidden_on: null
    });
  });

  it("keeps visible_on only for 'scheduled_visible'", () => {
    expect(getVisibilityValues("scheduled_visible", V, H)).toEqual({
      visible: false,
      visible_on: V,
      hidden_on: null
    });
  });

  it("keeps hidden_on only and is visible for 'scheduled_hidden'", () => {
    expect(getVisibilityValues("scheduled_hidden", V, H)).toEqual({
      visible: true,
      visible_on: null,
      hidden_on: H
    });
  });

  it("keeps both dates for 'scheduled_period'", () => {
    expect(getVisibilityValues("scheduled_period", V, H)).toEqual({
      visible: false,
      visible_on: V,
      hidden_on: H
    });
  });
});
