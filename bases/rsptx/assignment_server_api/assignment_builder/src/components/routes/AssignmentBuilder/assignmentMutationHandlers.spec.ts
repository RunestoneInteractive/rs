import { vi } from "vitest";

import { Assignment } from "@/types/assignment";
import { notify } from "@components/ui/notify";

import {
  getEnforceDueToastCopy,
  getVisibilityToastCopy,
  saveEnforceDue,
  saveVisibility,
  UpdateAssignmentTrigger
} from "./assignmentMutationHandlers";

vi.mock("@components/ui/notify", () => ({
  notify: {
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    update: vi.fn(),
    hide: vi.fn(),
    clean: vi.fn()
  }
}));

const makeAssignment = (overrides: Partial<Assignment> = {}): Assignment =>
  ({
    id: 1,
    name: "Homework 1",
    visible: true,
    visible_on: null,
    hidden_on: null,
    enforce_due: false,
    ...overrides
  }) as Assignment;

const makeResolvingTrigger = (): UpdateAssignmentTrigger =>
  vi.fn(() => {
    const result = Promise.resolve({ data: undefined });

    return Object.assign(result, { unwrap: () => Promise.resolve(undefined) });
  });

const makeRejectingTrigger = (): UpdateAssignmentTrigger =>
  vi.fn(() => {
    const result = Promise.resolve({ error: { status: 500 } });

    return Object.assign(result, {
      unwrap: () => Promise.reject(new Error("update failed"))
    });
  });

describe("saveEnforceDue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the toggled enforce_due value and toasts success", async () => {
    const trigger = makeResolvingTrigger();
    const assignment = makeAssignment();

    await saveEnforceDue(trigger, assignment, true);

    expect(trigger).toHaveBeenCalledWith({ ...assignment, enforce_due: true });
    expect(notify.success).toHaveBeenCalledWith("Late submissions not allowed");
  });

  it("toasts the allowed copy when enforce_due is turned off", async () => {
    await saveEnforceDue(makeResolvingTrigger(), makeAssignment({ enforce_due: true }), false);

    expect(notify.success).toHaveBeenCalledWith("Late submissions allowed");
  });

  it("does not toast success when the mutation fails", async () => {
    await saveEnforceDue(makeRejectingTrigger(), makeAssignment(), true);

    expect(notify.success).not.toHaveBeenCalled();
  });
});

describe("saveVisibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges the visibility update into the assignment and toasts success", async () => {
    const trigger = makeResolvingTrigger();
    const assignment = makeAssignment();
    const update = { visible: false, visible_on: null, hidden_on: null };

    await saveVisibility(trigger, assignment, update);

    expect(trigger).toHaveBeenCalledWith({ ...assignment, ...update });
    expect(notify.success).toHaveBeenCalledWith("Assignment is now hidden");
  });

  it("does not toast success when the mutation fails", async () => {
    await saveVisibility(makeRejectingTrigger(), makeAssignment(), {
      visible: true,
      visible_on: null,
      hidden_on: null
    });

    expect(notify.success).not.toHaveBeenCalled();
  });
});

describe("getEnforceDueToastCopy", () => {
  it("maps enforce_due to the late-submission copy", () => {
    expect(getEnforceDueToastCopy(true)).toBe("Late submissions not allowed");
    expect(getEnforceDueToastCopy(false)).toBe("Late submissions allowed");
  });
});

describe("getVisibilityToastCopy", () => {
  it("describes the visible mode", () => {
    expect(getVisibilityToastCopy({ visible: true, visible_on: null, hidden_on: null })).toBe(
      "Assignment is now visible"
    );
  });

  it("describes the hidden mode", () => {
    expect(getVisibilityToastCopy({ visible: false, visible_on: null, hidden_on: null })).toBe(
      "Assignment is now hidden"
    );
  });

  it("describes every scheduled mode as scheduled", () => {
    expect(
      getVisibilityToastCopy({ visible: false, visible_on: "2026-06-20T00:00:00", hidden_on: null })
    ).toBe("Assignment visibility is scheduled");
    expect(
      getVisibilityToastCopy({ visible: true, visible_on: null, hidden_on: "2026-06-20T23:59:00" })
    ).toBe("Assignment visibility is scheduled");
    expect(
      getVisibilityToastCopy({
        visible: false,
        visible_on: "2026-06-20T00:00:00",
        hidden_on: "2026-06-21T23:59:00"
      })
    ).toBe("Assignment visibility is scheduled");
  });
});
