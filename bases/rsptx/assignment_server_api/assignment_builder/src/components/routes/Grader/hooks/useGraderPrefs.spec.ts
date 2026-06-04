import { renderHook, act } from "@testing-library/react";
import { useGraderPrefs, GraderPrefs } from "./useGraderPrefs";

const STORAGE_KEY = "rs-grader-prefs-v1";

describe("useGraderPrefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default prefs when localStorage is empty", () => {
    const { result } = renderHook(() => useGraderPrefs());
    expect(result.current.prefs).toEqual({ autoAdvance: false });
  });

  it("reads persisted prefs from localStorage on mount", () => {
    const saved: GraderPrefs = { autoAdvance: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useGraderPrefs());
    expect(result.current.prefs.autoAdvance).toBe(true);
  });

  it("merges partial localStorage data with defaults", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({}));

    const { result } = renderHook(() => useGraderPrefs());
    expect(result.current.prefs).toEqual({ autoAdvance: false });
  });

  it("falls back to defaults when localStorage contains invalid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-json{{{");

    const { result } = renderHook(() => useGraderPrefs());
    expect(result.current.prefs).toEqual({ autoAdvance: false });
  });

  it("updatePrefs merges a partial patch into current prefs", () => {
    const { result } = renderHook(() => useGraderPrefs());

    act(() => {
      result.current.updatePrefs({ autoAdvance: true });
    });

    expect(result.current.prefs.autoAdvance).toBe(true);
  });

  it("updatePrefs persists updated prefs to localStorage", () => {
    const { result } = renderHook(() => useGraderPrefs());

    act(() => {
      result.current.updatePrefs({ autoAdvance: true });
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored).toEqual({ autoAdvance: true });
  });

  it("updatePrefs keeps unpatched fields intact", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ autoAdvance: true }));

    const { result } = renderHook(() => useGraderPrefs());

    act(() => {
      result.current.updatePrefs({});
    });

    expect(result.current.prefs.autoAdvance).toBe(true);
  });

  it("updatePrefs reference is stable across renders", () => {
    const { result, rerender } = renderHook(() => useGraderPrefs());
    const first = result.current.updatePrefs;

    rerender();

    expect(result.current.updatePrefs).toBe(first);
  });

  it("reacts to a storage event with the matching key by reloading prefs", () => {
    const { result } = renderHook(() => useGraderPrefs());
    expect(result.current.prefs.autoAdvance).toBe(false);

    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ autoAdvance: true }));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEY,
          newValue: JSON.stringify({ autoAdvance: true }),
          storageArea: localStorage
        })
      );
    });

    expect(result.current.prefs.autoAdvance).toBe(true);
  });

  it("ignores storage events with a different key", () => {
    const { result } = renderHook(() => useGraderPrefs());

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "some-other-key",
          newValue: JSON.stringify({ autoAdvance: true }),
          storageArea: localStorage
        })
      );
    });

    expect(result.current.prefs.autoAdvance).toBe(false);
  });

  it("removes the storage event listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useGraderPrefs());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("storage", expect.any(Function));
    removeSpy.mockRestore();
  });
});
