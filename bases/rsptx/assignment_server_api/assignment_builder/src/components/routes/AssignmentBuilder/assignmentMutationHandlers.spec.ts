import { vi } from "vitest";

import { Assignment } from "@/types/assignment";
import { notify } from "@components/ui/notify";

import {
  BulkUpdateAssignmentsTrigger,
  getBulkEnforceDueToastCopy,
  getBulkUpdateErrorToastCopy,
  getBulkVisibilityToastCopy,
  getEnforceDueToastCopy,
  getVisibilityToastCopy,
  saveBulkEnforceDue,
  saveBulkVisibility,
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

  const makeBulkTrigger = (result: {
    succeeded: number;
    failed: number;
  }): BulkUpdateAssignmentsTrigger => vi.fn(() => ({ unwrap: () => Promise.resolve(result) }));

  const makeRejectingBulkTrigger = (): BulkUpdateAssignmentsTrigger =>
    vi.fn(() => ({ unwrap: () => Promise.reject(new Error("bulk update failed")) }));

  describe("saveBulkVisibility", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("merges the update into every assignment and toasts a bulk success", async () => {
      const trigger = makeBulkTrigger({ succeeded: 2, failed: 0 });
      const assignments = [
        makeAssignment({ id: 1 }),
        makeAssignment({ id: 2, name: "Homework 2" })
      ];
      const update = { visible: true, visible_on: null, hidden_on: null };

      await saveBulkVisibility(trigger, assignments, update);

      expect(trigger).toHaveBeenCalledWith(
        assignments.map((assignment) => ({ ...assignment, ...update }))
      );
      expect(notify.success).toHaveBeenCalledWith("2 assignments now visible");
      expect(notify.error).not.toHaveBeenCalled();
    });

    it("toasts both success and error copies on a partial failure", async () => {
      const trigger = makeBulkTrigger({ succeeded: 1, failed: 2 });

      await saveBulkVisibility(trigger, [makeAssignment(), makeAssignment(), makeAssignment()], {
        visible: false,
        visible_on: null,
        hidden_on: null
      });

      expect(notify.success).toHaveBeenCalledWith("1 assignment now hidden");
      expect(notify.error).toHaveBeenCalledWith("Couldn't update 2 assignments. Try again.");
    });

    it("only toasts the error copy when the mutation rejects", async () => {
      await saveBulkVisibility(makeRejectingBulkTrigger(), [makeAssignment()], {
        visible: true,
        visible_on: null,
        hidden_on: null
      });

      expect(notify.success).not.toHaveBeenCalled();
      expect(notify.error).toHaveBeenCalledWith("Couldn't update 1 assignment. Try again.");
    });

    it("does nothing for an empty selection", async () => {
      const trigger = makeBulkTrigger({ succeeded: 0, failed: 0 });

      await saveBulkVisibility(trigger, [], { visible: true, visible_on: null, hidden_on: null });

      expect(trigger).not.toHaveBeenCalled();
      expect(notify.success).not.toHaveBeenCalled();
      expect(notify.error).not.toHaveBeenCalled();
    });
  });

  describe("saveBulkEnforceDue", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("applies the enforce_due patch to every assignment and toasts success", async () => {
      const trigger = makeBulkTrigger({ succeeded: 2, failed: 0 });
      const assignments = [makeAssignment({ id: 1 }), makeAssignment({ id: 2 })];

      await saveBulkEnforceDue(trigger, assignments, true);

      expect(trigger).toHaveBeenCalledWith(
        assignments.map((assignment) => ({ ...assignment, enforce_due: true }))
      );
      expect(notify.success).toHaveBeenCalledWith("Late submissions not allowed for 2 assignments");
    });

    it("toasts the allowed copy when enforce_due is turned off", async () => {
      await saveBulkEnforceDue(
        makeBulkTrigger({ succeeded: 1, failed: 0 }),
        [makeAssignment()],
        false
      );

      expect(notify.success).toHaveBeenCalledWith("Late submissions allowed for 1 assignment");
    });

    it("does nothing for an empty selection", async () => {
      const trigger = makeBulkTrigger({ succeeded: 0, failed: 0 });

      await saveBulkEnforceDue(trigger, [], true);

      expect(trigger).not.toHaveBeenCalled();
    });
  });

  describe("bulk toast copy helpers", () => {
    it("describes bulk visibility per mode with singular and plural subjects", () => {
      expect(
        getBulkVisibilityToastCopy(1, { visible: true, visible_on: null, hidden_on: null })
      ).toBe("1 assignment now visible");
      expect(
        getBulkVisibilityToastCopy(3, { visible: false, visible_on: null, hidden_on: null })
      ).toBe("3 assignments now hidden");
      expect(
        getBulkVisibilityToastCopy(2, {
          visible: false,
          visible_on: "2026-06-20T00:00:00",
          hidden_on: null
        })
      ).toBe("Visibility scheduled for 2 assignments");
    });

    it("describes bulk enforce_due copy", () => {
      expect(getBulkEnforceDueToastCopy(2, true)).toBe(
        "Late submissions not allowed for 2 assignments"
      );
      expect(getBulkEnforceDueToastCopy(1, false)).toBe(
        "Late submissions allowed for 1 assignment"
      );
    });

    it("phrases the bulk error as couldn't-verb plus a fix", () => {
      expect(getBulkUpdateErrorToastCopy(1)).toBe("Couldn't update 1 assignment. Try again.");
      expect(getBulkUpdateErrorToastCopy(4)).toBe("Couldn't update 4 assignments. Try again.");
    });
  });
});
