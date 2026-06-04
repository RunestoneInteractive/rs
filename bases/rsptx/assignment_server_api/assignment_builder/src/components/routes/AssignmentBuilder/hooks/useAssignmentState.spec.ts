import { renderHook, act } from "@testing-library/react";
import { useAssignmentState } from "./useAssignmentState";
import { Assignment, KindOfAssignment } from "@/types/assignment";
import { UseFormSetValue } from "react-hook-form";

const makeSetValue = (): jest.Mock => vi.fn() as unknown as jest.Mock;

describe("useAssignmentState", () => {
  describe("initial state", () => {
    it("returns empty string as default globalFilter", () => {
      const { result } = renderHook(() => useAssignmentState());
      expect(result.current.globalFilter).toBe("");
    });

    it("returns false as default isCollapsed", () => {
      const { result } = renderHook(() => useAssignmentState());
      expect(result.current.isCollapsed).toBe(false);
    });
  });

  describe("setGlobalFilter", () => {
    it("updates globalFilter when called with a new value", () => {
      const { result } = renderHook(() => useAssignmentState());
      act(() => {
        result.current.setGlobalFilter("search term");
      });
      expect(result.current.globalFilter).toBe("search term");
    });

    it("clears globalFilter when called with empty string", () => {
      const { result } = renderHook(() => useAssignmentState());
      act(() => {
        result.current.setGlobalFilter("something");
      });
      act(() => {
        result.current.setGlobalFilter("");
      });
      expect(result.current.globalFilter).toBe("");
    });
  });

  describe("setIsCollapsed", () => {
    it("updates isCollapsed to true", () => {
      const { result } = renderHook(() => useAssignmentState());
      act(() => {
        result.current.setIsCollapsed(true);
      });
      expect(result.current.isCollapsed).toBe(true);
    });

    it("toggles isCollapsed back to false", () => {
      const { result } = renderHook(() => useAssignmentState());
      act(() => {
        result.current.setIsCollapsed(true);
      });
      act(() => {
        result.current.setIsCollapsed(false);
      });
      expect(result.current.isCollapsed).toBe(false);
    });
  });

  describe("handleTypeSelect", () => {
    it("resets all type-specific fields before applying type defaults for any type", () => {
      const { result } = renderHook(() => useAssignmentState());
      const setValue = makeSetValue();

      act(() => {
        result.current.handleTypeSelect(
          "Regular",
          setValue as unknown as UseFormSetValue<Assignment>
        );
      });

      expect(setValue).toHaveBeenCalledWith("is_timed", false);
      expect(setValue).toHaveBeenCalledWith("is_peer", false);
      expect(setValue).toHaveBeenCalledWith("nopause", false);
      expect(setValue).toHaveBeenCalledWith("nofeedback", false);
      expect(setValue).toHaveBeenCalledWith("time_limit", null);
      expect(setValue).toHaveBeenCalledWith("peer_async_visible", false);
    });

    it("sets kind to the provided type", () => {
      const { result } = renderHook(() => useAssignmentState());
      const setValue = makeSetValue();

      act(() => {
        result.current.handleTypeSelect(
          "Regular",
          setValue as unknown as UseFormSetValue<Assignment>
        );
      });

      expect(setValue).toHaveBeenCalledWith("kind", "Regular");
    });

    describe("when type is Timed", () => {
      it("sets is_timed to true", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Timed",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        expect(setValue).toHaveBeenCalledWith("is_timed", true);
      });

      it("sets default time_limit to 60", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Timed",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        expect(setValue).toHaveBeenCalledWith("time_limit", 60);
      });

      it("sets nopause to false to allow pausing", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Timed",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        const nopauseCalls = (setValue as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([field]: [string]) => field === "nopause"
        );
        expect(nopauseCalls.at(-1)).toEqual(["nopause", false]);
      });

      it("sets nofeedback to false to allow feedback", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Timed",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        const nofeedbackCalls = (setValue as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([field]: [string]) => field === "nofeedback"
        );
        expect(nofeedbackCalls.at(-1)).toEqual(["nofeedback", false]);
      });

      it("does not set is_peer to true", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Timed",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        const isPeerTrueCalls = (setValue as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([field, value]: [string, unknown]) => field === "is_peer" && value === true
        );
        expect(isPeerTrueCalls).toHaveLength(0);
      });

      it("sets kind to Timed", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Timed",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        expect(setValue).toHaveBeenCalledWith("kind", "Timed");
      });
    });

    describe("when type is Peer", () => {
      it("sets is_peer to true", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Peer",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        expect(setValue).toHaveBeenCalledWith("is_peer", true);
      });

      it("sets peer_async_visible to false", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Peer",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        const peerAsyncCalls = (setValue as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([field]: [string]) => field === "peer_async_visible"
        );
        expect(peerAsyncCalls.at(-1)).toEqual(["peer_async_visible", false]);
      });

      it("does not set is_timed to true", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Peer",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        const isTimedTrueCalls = (
          setValue as unknown as ReturnType<typeof vi.fn>
        ).mock.calls.filter(
          ([field, value]: [string, unknown]) => field === "is_timed" && value === true
        );
        expect(isTimedTrueCalls).toHaveLength(0);
      });

      it("does not set time_limit to a non-null value", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Peer",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        const timeLimitNonNullCalls = (
          setValue as unknown as ReturnType<typeof vi.fn>
        ).mock.calls.filter(
          ([field, value]: [string, unknown]) => field === "time_limit" && value !== null
        );
        expect(timeLimitNonNullCalls).toHaveLength(0);
      });

      it("sets kind to Peer", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Peer",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        expect(setValue).toHaveBeenCalledWith("kind", "Peer");
      });
    });

    describe("when type is Regular", () => {
      it("does not set is_timed to true", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Regular",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        const isTimedTrueCalls = (
          setValue as unknown as ReturnType<typeof vi.fn>
        ).mock.calls.filter(
          ([field, value]: [string, unknown]) => field === "is_timed" && value === true
        );
        expect(isTimedTrueCalls).toHaveLength(0);
      });

      it("does not set is_peer to true", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Regular",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        const isPeerTrueCalls = (setValue as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([field, value]: [string, unknown]) => field === "is_peer" && value === true
        );
        expect(isPeerTrueCalls).toHaveLength(0);
      });

      it("sets kind to Regular", () => {
        const { result } = renderHook(() => useAssignmentState());
        const setValue = makeSetValue();

        act(() => {
          result.current.handleTypeSelect(
            "Regular",
            setValue as unknown as UseFormSetValue<Assignment>
          );
        });

        expect(setValue).toHaveBeenCalledWith("kind", "Regular");
      });
    });

    it("can be called multiple times with different types and each call resets fields", () => {
      const { result } = renderHook(() => useAssignmentState());
      const setValue = makeSetValue();

      act(() => {
        result.current.handleTypeSelect(
          "Timed",
          setValue as unknown as UseFormSetValue<Assignment>
        );
      });
      act(() => {
        result.current.handleTypeSelect("Peer", setValue as unknown as UseFormSetValue<Assignment>);
      });

      const allCalls = (setValue as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const isTimedResets = allCalls.filter(
        ([field, value]: [string, unknown]) => field === "is_timed" && value === false
      );
      expect(isTimedResets.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("return shape", () => {
    it("exposes all expected keys", () => {
      const { result } = renderHook(() => useAssignmentState());
      expect(result.current).toHaveProperty("globalFilter");
      expect(result.current).toHaveProperty("setGlobalFilter");
      expect(result.current).toHaveProperty("isCollapsed");
      expect(result.current).toHaveProperty("setIsCollapsed");
      expect(result.current).toHaveProperty("handleTypeSelect");
    });
  });
});
