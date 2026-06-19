import { renderHook, act } from "@testing-library/react";
import { useNameValidation } from "./useNameValidation";
import { Assignment } from "@/types/assignment";

const makeAssignment = (name: string): Pick<Assignment, "name"> & Partial<Assignment> =>
  ({ name }) as Assignment;

const makeWatch = (initialName: string | undefined) => {
  type Subscriber = (value: Partial<Assignment>, info: { name?: string }) => void;
  let currentSubscriber: Subscriber | null = null;
  let currentName = initialName;

  const watch = vi.fn((fieldOrCallback?: string | Subscriber) => {
    if (typeof fieldOrCallback === "function") {
      currentSubscriber = fieldOrCallback;
      return {
        unsubscribe: () => {
          if (currentSubscriber === fieldOrCallback) {
            currentSubscriber = null;
          }
        }
      };
    }
    return currentName;
  }) as unknown as ReturnType<typeof import("react-hook-form").useForm>["watch"];

  const trigger = (name: string | undefined, fieldName?: string) => {
    currentName = name;
    if (currentSubscriber) {
      currentSubscriber({ name }, { name: fieldName });
    }
  };

  return { watch, trigger };
};

describe("useNameValidation", () => {
  describe("validateName (pure validation logic)", () => {
    it("returns an error when name is empty string", () => {
      const { watch } = makeWatch("");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));
      expect(result.current.validateName("")).toBe("Assignment name is required");
    });

    it("returns an error when name is only whitespace", () => {
      const { watch } = makeWatch("   ");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));
      expect(result.current.validateName("   ")).toBe("Assignment name is required");
    });

    it("returns null for a valid unique name", () => {
      const { watch } = makeWatch("New");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));
      expect(result.current.validateName("New")).toBeNull();
    });

    it("returns duplicate error when name matches an existing assignment (case-insensitive)", () => {
      const assignments = [makeAssignment("Homework 1")] as Assignment[];
      const { watch } = makeWatch("Homework 1");
      const { result } = renderHook(() => useNameValidation({ assignments, watch }));
      expect(result.current.validateName("homework 1")).toBe(
        "An assignment with this name already exists. Pick another name."
      );
    });

    it("returns duplicate error for exact case match", () => {
      const assignments = [makeAssignment("Quiz")] as Assignment[];
      const { watch } = makeWatch("Quiz");
      const { result } = renderHook(() => useNameValidation({ assignments, watch }));
      expect(result.current.validateName("Quiz")).toBe(
        "An assignment with this name already exists. Pick another name."
      );
    });

    it("returns null when name is unique among existing assignments", () => {
      const assignments = [makeAssignment("Old Assignment")] as Assignment[];
      const { watch } = makeWatch("New Assignment");
      const { result } = renderHook(() => useNameValidation({ assignments, watch }));
      expect(result.current.validateName("New Assignment")).toBeNull();
    });
  });

  describe("initial state", () => {
    it("starts with nameError null and canProceed false when initial name is empty", () => {
      const { watch } = makeWatch("");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));
      expect(result.current.nameError).toBeNull();
      expect(result.current.canProceed).toBe(false);
    });

    it("starts with canProceed true when initial name is valid", () => {
      const { watch } = makeWatch("Valid Name");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));
      expect(result.current.canProceed).toBe(true);
    });

    it("does not show nameError even if initial name is invalid (not touched)", () => {
      const { watch } = makeWatch("");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));
      expect(result.current.nameError).toBeNull();
    });
  });

  describe("after the name field is touched", () => {
    it("sets canProceed false when user clears the name field", () => {
      const { watch, trigger } = makeWatch("Some Name");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));

      act(() => {
        trigger("", "name");
      });

      expect(result.current.canProceed).toBe(false);
    });

    it("shows error after the name field has been touched twice (state settled)", () => {
      const { watch, trigger } = makeWatch("Some Name");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));

      act(() => {
        trigger("Some Name", "name");
      });
      act(() => {
        trigger("", "name");
      });

      expect(result.current.nameError).toBe("Assignment name is required");
      expect(result.current.canProceed).toBe(false);
    });

    it("shows duplicate error after two name-field changes", () => {
      const assignments = [makeAssignment("Homework")] as Assignment[];
      const { watch, trigger } = makeWatch("Something");
      const { result } = renderHook(() => useNameValidation({ assignments, watch }));

      act(() => {
        trigger("Something", "name");
      });
      act(() => {
        trigger("Homework", "name");
      });

      expect(result.current.nameError).toBe("An assignment with this name already exists. Pick another name.");
      expect(result.current.canProceed).toBe(false);
    });

    it("clears error and sets canProceed true when user enters a valid name after invalid", () => {
      const { watch, trigger } = makeWatch("");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));

      act(() => {
        trigger("", "name");
      });
      act(() => {
        trigger("", "name");
      });

      expect(result.current.nameError).not.toBeNull();

      act(() => {
        trigger("Good Name", "name");
      });

      expect(result.current.nameError).toBeNull();
      expect(result.current.canProceed).toBe(true);
    });

    it("does not show error when another field changes before name is touched", () => {
      const { watch, trigger } = makeWatch("");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));

      act(() => {
        trigger("", "description");
      });

      expect(result.current.nameError).toBeNull();
    });

    it("marks as touched when name field changes and shows error on subsequent empty value", () => {
      const { watch, trigger } = makeWatch("Initial");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));

      act(() => {
        trigger("Initial", "name");
      });
      act(() => {
        trigger("   ", "name");
      });

      expect(result.current.nameError).toBe("Assignment name is required");
      expect(result.current.canProceed).toBe(false);
    });
  });

  describe("canProceed logic", () => {
    it("is false when name is empty regardless of touched state", () => {
      const { watch } = makeWatch("");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));
      expect(result.current.canProceed).toBe(false);
    });

    it("is false when name is a duplicate", () => {
      const assignments = [makeAssignment("Dup")] as Assignment[];
      const { watch } = makeWatch("Dup");
      const { result } = renderHook(() => useNameValidation({ assignments, watch }));
      expect(result.current.canProceed).toBe(false);
    });

    it("is true when name is non-empty and unique", () => {
      const { watch } = makeWatch("Unique");
      const { result } = renderHook(() => useNameValidation({ assignments: [], watch }));
      expect(result.current.canProceed).toBe(true);
    });
  });
});
