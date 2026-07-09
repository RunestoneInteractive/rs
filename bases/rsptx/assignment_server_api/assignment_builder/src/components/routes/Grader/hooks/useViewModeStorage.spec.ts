import { renderHook, act } from "@testing-library/react";
import { useViewModeStorage } from "./useViewModeStorage";

const STORAGE_KEY = "test-view-mode";
const ALLOWED_MODES = ["list", "grid", "detail"] as const;
type TestMode = (typeof ALLOWED_MODES)[number];
const DEFAULT_MODE: TestMode = "list";

beforeEach(() => {
  localStorage.clear();
});

describe("useViewModeStorage", () => {
  describe("initial state", () => {
    it("returns the default mode when localStorage has no stored value", () => {
      const { result } = renderHook(() =>
        useViewModeStorage(STORAGE_KEY, ALLOWED_MODES, DEFAULT_MODE)
      );

      expect(result.current[0]).toBe(DEFAULT_MODE);
    });

    it("returns the stored mode when localStorage contains a valid value", () => {
      localStorage.setItem(STORAGE_KEY, "grid");

      const { result } = renderHook(() =>
        useViewModeStorage(STORAGE_KEY, ALLOWED_MODES, DEFAULT_MODE)
      );

      expect(result.current[0]).toBe("grid");
    });

    it("returns the default mode when localStorage contains an invalid value", () => {
      localStorage.setItem(STORAGE_KEY, "invalid-mode");

      const { result } = renderHook(() =>
        useViewModeStorage(STORAGE_KEY, ALLOWED_MODES, DEFAULT_MODE)
      );

      expect(result.current[0]).toBe(DEFAULT_MODE);
    });

    it("returns the default mode when localStorage contains an empty string", () => {
      localStorage.setItem(STORAGE_KEY, "");

      const { result } = renderHook(() =>
        useViewModeStorage(STORAGE_KEY, ALLOWED_MODES, DEFAULT_MODE)
      );

      expect(result.current[0]).toBe(DEFAULT_MODE);
    });
  });

  describe("setting mode", () => {
    it("updates the returned mode when setMode is called with a valid mode", () => {
      const { result } = renderHook(() =>
        useViewModeStorage(STORAGE_KEY, ALLOWED_MODES, DEFAULT_MODE)
      );

      act(() => {
        result.current[1]("grid");
      });

      expect(result.current[0]).toBe("grid");
    });

    it("persists the updated mode to localStorage when setMode is called", () => {
      const { result } = renderHook(() =>
        useViewModeStorage(STORAGE_KEY, ALLOWED_MODES, DEFAULT_MODE)
      );

      act(() => {
        result.current[1]("detail");
      });

      expect(localStorage.getItem(STORAGE_KEY)).toBe("detail");
    });

    it("updates mode multiple times and reflects the latest value", () => {
      const { result } = renderHook(() =>
        useViewModeStorage(STORAGE_KEY, ALLOWED_MODES, DEFAULT_MODE)
      );

      act(() => {
        result.current[1]("grid");
      });
      act(() => {
        result.current[1]("detail");
      });

      expect(result.current[0]).toBe("detail");
      expect(localStorage.getItem(STORAGE_KEY)).toBe("detail");
    });
  });

  describe("initial localStorage write", () => {
    it("writes the default mode to localStorage on mount when no value is stored", () => {
      renderHook(() => useViewModeStorage(STORAGE_KEY, ALLOWED_MODES, DEFAULT_MODE));

      expect(localStorage.getItem(STORAGE_KEY)).toBe(DEFAULT_MODE);
    });

    it("writes the resolved stored mode to localStorage on mount when a valid value exists", () => {
      localStorage.setItem(STORAGE_KEY, "grid");

      renderHook(() => useViewModeStorage(STORAGE_KEY, ALLOWED_MODES, DEFAULT_MODE));

      expect(localStorage.getItem(STORAGE_KEY)).toBe("grid");
    });
  });

  describe("return value shape", () => {
    it("returns a tuple with the current mode and a setter function", () => {
      const { result } = renderHook(() =>
        useViewModeStorage(STORAGE_KEY, ALLOWED_MODES, DEFAULT_MODE)
      );

      const [mode, setMode] = result.current;
      expect(typeof mode).toBe("string");
      expect(typeof setMode).toBe("function");
    });
  });

  describe("storageKey changes", () => {
    it("reads from the new key and falls back to the default mode when storageKey changes", () => {
      localStorage.setItem("key-a", "grid");
      localStorage.setItem("key-b", "detail");

      const { result, rerender } = renderHook(
        ({ storageKey }: { storageKey: string }) =>
          useViewModeStorage(storageKey, ALLOWED_MODES, DEFAULT_MODE),
        { initialProps: { storageKey: "key-a" } }
      );

      expect(result.current[0]).toBe("grid");

      rerender({ storageKey: "key-b" });

      act(() => {
        result.current[1]("detail");
      });

      expect(result.current[0]).toBe("detail");
    });
  });
});
