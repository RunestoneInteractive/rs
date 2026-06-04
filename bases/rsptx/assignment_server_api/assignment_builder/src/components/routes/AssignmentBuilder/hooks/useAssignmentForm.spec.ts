import { renderHook, act } from "@testing-library/react";
import { useAssignmentForm } from "./useAssignmentForm";
import { Assignment } from "@/types/assignment";

const makeAssignment = (overrides: Partial<Assignment> = {}): Assignment => ({
  id: 1,
  name: "Test Assignment",
  description: "desc",
  duedate: "2026-01-01T00:00:00",
  updated_date: null,
  visible_on: null,
  hidden_on: null,
  points: 10,
  visible: true,
  is_peer: false,
  is_timed: false,
  nofeedback: false,
  nopause: false,
  time_limit: null,
  peer_async_visible: false,
  kind: "Regular",
  exercises: [],
  all_assignments: [],
  search_results: [],
  question_count: 0,
  isAuthorized: true,
  released: true,
  selectedAssignments: [],
  course: 1,
  threshold_pct: null,
  allow_self_autograde: null,
  from_source: false,
  current_index: 0,
  enforce_due: false,
  ...overrides
});

describe("useAssignmentForm", () => {
  describe("initial state", () => {
    it("uses defaultAssignment values when selectedAssignment is null", () => {
      const { result } = renderHook(() =>
        useAssignmentForm({ selectedAssignment: null, mode: "create" })
      );

      expect(result.current.getValues("name")).toBe("");
      expect(result.current.getValues("points")).toBe(0);
      expect(result.current.getValues("kind")).toBe("Regular");
    });

    it("uses selectedAssignment values as defaults when provided", () => {
      const assignment = makeAssignment({ name: "My Assignment", points: 50 });

      const { result } = renderHook(() =>
        useAssignmentForm({ selectedAssignment: assignment, mode: "edit" })
      );

      expect(result.current.getValues("name")).toBe("My Assignment");
      expect(result.current.getValues("points")).toBe(50);
    });
  });

  describe("returns expected API", () => {
    it("returns control, watch, setValue, reset, getValues, handleNameChange", () => {
      const { result } = renderHook(() =>
        useAssignmentForm({ selectedAssignment: null, mode: "create" })
      );

      expect(result.current.control).toBeDefined();
      expect(typeof result.current.watch).toBe("function");
      expect(typeof result.current.setValue).toBe("function");
      expect(typeof result.current.reset).toBe("function");
      expect(typeof result.current.getValues).toBe("function");
      expect(typeof result.current.handleNameChange).toBe("function");
    });
  });

  describe("handleNameChange", () => {
    it("sets the name field value", () => {
      const { result } = renderHook(() =>
        useAssignmentForm({ selectedAssignment: null, mode: "create" })
      );

      act(() => {
        result.current.handleNameChange("New Name");
      });

      expect(result.current.getValues("name")).toBe("New Name");
    });

    it("overwrites an existing name value", () => {
      const assignment = makeAssignment({ name: "Old Name" });
      const { result } = renderHook(() =>
        useAssignmentForm({ selectedAssignment: assignment, mode: "edit" })
      );

      act(() => {
        result.current.handleNameChange("Updated Name");
      });

      expect(result.current.getValues("name")).toBe("Updated Name");
    });
  });

  describe("reset on selectedAssignment change in edit mode", () => {
    it("resets form values when a different assignment is selected in edit mode", () => {
      const first = makeAssignment({ id: 1, name: "First", points: 10 });
      const second = makeAssignment({ id: 2, name: "Second", points: 20 });

      const { result, rerender } = renderHook(
        ({ assignment }: { assignment: Assignment }) =>
          useAssignmentForm({ selectedAssignment: assignment, mode: "edit" }),
        { initialProps: { assignment: first } }
      );

      expect(result.current.getValues("name")).toBe("First");

      act(() => {
        rerender({ assignment: second });
      });

      expect(result.current.getValues("name")).toBe("Second");
      expect(result.current.getValues("points")).toBe(20);
    });

    it("resets the form when the assignment arrives after mount", () => {
      const assignment = makeAssignment({ id: 7, name: "Loaded", kind: "Peer", is_peer: true });

      const { result, rerender } = renderHook(
        ({ selected }: { selected: Assignment | null }) =>
          useAssignmentForm({ selectedAssignment: selected, mode: "edit" }),
        { initialProps: { selected: null as Assignment | null } }
      );

      expect(result.current.getValues("kind")).toBe("Regular");

      act(() => {
        rerender({ selected: assignment });
      });

      expect(result.current.getValues("name")).toBe("Loaded");
      expect(result.current.getValues("kind")).toBe("Peer");
    });

    it("does not call onAssignmentUpdate for the programmatic reset", () => {
      const onAssignmentUpdate = vi.fn();
      const assignment = makeAssignment({ id: 7, name: "Loaded" });

      const { rerender } = renderHook(
        ({ selected }: { selected: Assignment | null }) =>
          useAssignmentForm({ selectedAssignment: selected, mode: "edit", onAssignmentUpdate }),
        { initialProps: { selected: null as Assignment | null } }
      );

      act(() => {
        rerender({ selected: assignment });
      });

      expect(onAssignmentUpdate).not.toHaveBeenCalled();
    });

    it("keeps dirty user edits when the same assignment refetches with a new identity", () => {
      const server = makeAssignment({ id: 1, name: "Server name" });
      const refetched = makeAssignment({ id: 1, name: "Server name" });

      const { result, rerender } = renderHook(
        ({ assignment }: { assignment: Assignment }) =>
          useAssignmentForm({ selectedAssignment: assignment, mode: "edit" }),
        { initialProps: { assignment: server } }
      );

      act(() => {
        result.current.setValue("name", "User typing", { shouldDirty: true });
      });

      act(() => {
        rerender({ assignment: refetched });
      });

      expect(result.current.getValues("name")).toBe("User typing");
    });

    it("resets again when re-entering edit mode for the same assignment", () => {
      const assignment = makeAssignment({ id: 1, name: "Server name" });

      const { result, rerender } = renderHook(
        ({ mode }: { mode: "list" | "create" | "edit" }) =>
          useAssignmentForm({ selectedAssignment: assignment, mode }),
        { initialProps: { mode: "edit" as "list" | "create" | "edit" } }
      );

      act(() => {
        result.current.setValue("name", "Abandoned edit", { shouldDirty: true });
      });

      act(() => {
        rerender({ mode: "list" });
      });

      act(() => {
        rerender({ mode: "edit" });
      });

      expect(result.current.getValues("name")).toBe("Server name");
    });
  });

  describe("watch subscription in edit mode", () => {
    it("calls onAssignmentUpdate when a field changes in edit mode", async () => {
      const assignment = makeAssignment({ name: "Original" });
      const onAssignmentUpdate = vi.fn();

      const { result } = renderHook(() =>
        useAssignmentForm({
          selectedAssignment: assignment,
          mode: "edit",
          onAssignmentUpdate
        })
      );

      act(() => {
        result.current.setValue("points", 99, { shouldDirty: true });
      });

      expect(onAssignmentUpdate).toHaveBeenCalled();
      const calledWith = onAssignmentUpdate.mock.calls[onAssignmentUpdate.mock.calls.length - 1][0];
      expect(calledWith.points).toBe(99);
    });

    it("does not call onAssignmentUpdate when mode is not edit", () => {
      const assignment = makeAssignment({ name: "Original" });
      const onAssignmentUpdate = vi.fn();

      const { result } = renderHook(() =>
        useAssignmentForm({
          selectedAssignment: assignment,
          mode: "create",
          onAssignmentUpdate
        })
      );

      act(() => {
        result.current.setValue("points", 42, { shouldDirty: true });
      });

      expect(onAssignmentUpdate).not.toHaveBeenCalled();
    });

    it("does not call onAssignmentUpdate when no callback is provided", () => {
      const assignment = makeAssignment();

      const { result } = renderHook(() =>
        useAssignmentForm({
          selectedAssignment: assignment,
          mode: "edit"
        })
      );

      expect(() => {
        act(() => {
          result.current.setValue("points", 5, { shouldDirty: true });
        });
      }).not.toThrow();
    });
  });
});
