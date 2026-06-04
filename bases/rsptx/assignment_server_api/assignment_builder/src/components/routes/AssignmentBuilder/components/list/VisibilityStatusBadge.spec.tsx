import { renderWithMantine, screen } from "@/test/renderWithMantine";
import { Assignment } from "@/types/assignment";

import { getVisibilityStatus, VisibilityStatusBadge } from "./VisibilityStatusBadge";

const base = (overrides: Partial<Assignment>): Assignment =>
  ({ visible: false, visible_on: null, hidden_on: null, ...overrides }) as Assignment;

describe("getVisibilityStatus", () => {
  it("reports plain Hidden as a neutral chip with no schedule", () => {
    const status = getVisibilityStatus(base({ visible: false }));

    expect(status.label).toBe("Hidden");
    expect(status.variant).toBe("neutral");
    expect(status.tooltip).toBe("");
  });

  it("reports plain Visible as a success chip with no schedule", () => {
    const status = getVisibilityStatus(base({ visible: true }));

    expect(status.label).toBe("Visible");
    expect(status.variant).toBe("success");
    expect(status.tooltip).toBe("");
  });

  it("reports pending visibility as an info chip before visible_on passes", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const status = getVisibilityStatus(
      base({ visible: false, visible_on: "2026-02-01T00:00:00Z" }),
      now
    );

    expect(status.label).toMatch(/^From /);
    expect(status.variant).toBe("info");
    expect(status.tooltip).toContain("Will become visible");
  });

  it("flips to Visible once visible_on has passed", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const status = getVisibilityStatus(
      base({ visible: false, visible_on: "2026-02-01T00:00:00Z" }),
      now
    );

    expect(status.label).toBe("Visible");
    expect(status.variant).toBe("success");
  });

  it("reports scheduled period before start as a single-line info range", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const status = getVisibilityStatus(
      base({
        visible: false,
        visible_on: "2026-02-01T00:00:00Z",
        hidden_on: "2026-03-01T00:00:00Z"
      }),
      now
    );

    expect(status.label).toContain("–");
    expect(status.variant).toBe("info");
    expect(status.tooltip).toContain("Visible from");
  });

  it("reports scheduled period in-window as a success chip with end date", () => {
    const now = new Date("2026-02-15T00:00:00Z");
    const status = getVisibilityStatus(
      base({
        visible: false,
        visible_on: "2026-02-01T00:00:00Z",
        hidden_on: "2026-03-01T00:00:00Z"
      }),
      now
    );

    expect(status.label).toMatch(/^Until /);
    expect(status.variant).toBe("success");
    expect(status.tooltip).toContain("Visible until");
  });

  it("reports scheduled period after end as a neutral Hidden chip", () => {
    const now = new Date("2026-04-01T00:00:00Z");
    const status = getVisibilityStatus(
      base({
        visible: false,
        visible_on: "2026-02-01T00:00:00Z",
        hidden_on: "2026-03-01T00:00:00Z"
      }),
      now
    );

    expect(status.label).toBe("Hidden");
    expect(status.variant).toBe("neutral");
    expect(status.tooltip).toContain("Period ended");
  });

  it("reports scheduled-hide for a visible assignment as an info chip before hidden_on", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const status = getVisibilityStatus(
      base({ visible: true, hidden_on: "2026-02-01T00:00:00Z" }),
      now
    );

    expect(status.label).toMatch(/^Until /);
    expect(status.variant).toBe("info");
    expect(status.tooltip).toContain("Will be hidden");
  });

  it("omits the year in chip labels when the date is in the current year", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const status = getVisibilityStatus(
      base({ visible: false, visible_on: "2026-02-01T00:00:00Z" }),
      now
    );

    expect(status.label).not.toContain("2026");
  });

  it("includes the year in chip labels when the date is in another year", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const status = getVisibilityStatus(
      base({ visible: false, visible_on: "2027-02-01T00:00:00Z" }),
      now
    );

    expect(status.label).toContain("2027");
  });
});

describe("VisibilityStatusBadge", () => {
  it("makes the scheduled chip focusable so the tooltip opens without a mouse", () => {
    const future = new Date();

    future.setFullYear(future.getFullYear() + 1);

    renderWithMantine(
      <VisibilityStatusBadge
        assignment={base({ visible: false, visible_on: future.toISOString() })}
      />
    );

    expect(screen.getByText(/^From /)).toHaveAttribute("tabindex", "0");
  });

  it("renders an unfocusable plain chip when there is no schedule tooltip", () => {
    renderWithMantine(<VisibilityStatusBadge assignment={base({ visible: true })} />);

    expect(screen.getByText("Visible")).not.toHaveAttribute("tabindex");
  });
});
