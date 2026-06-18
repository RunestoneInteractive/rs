import { act, renderHook } from "@testing-library/react";

import { useScrollShadow } from "./useScrollShadow";

type IntersectionCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

describe("useScrollShadow", () => {
  let intersectionCallback: IntersectionCallback | undefined;
  const observe = vi.fn();
  const disconnect = vi.fn();

  beforeEach(() => {
    intersectionCallback = undefined;
    observe.mockClear();
    disconnect.mockClear();
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((callback: IntersectionCallback) => {
        intersectionCallback = callback;
        return { observe, disconnect, unobserve: vi.fn() };
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with scrolled false", () => {
    const { result } = renderHook(() => useScrollShadow());

    expect(result.current.scrolled).toBe(false);
  });

  it("observes the sentinel node when the ref is attached", () => {
    const { result } = renderHook(() => useScrollShadow());
    const node = document.createElement("div");

    act(() => result.current.sentinelRef(node));

    expect(observe).toHaveBeenCalledWith(node);
  });

  it("sets scrolled true when the sentinel leaves the viewport", () => {
    const { result } = renderHook(() => useScrollShadow());
    const node = document.createElement("div");

    act(() => result.current.sentinelRef(node));
    act(() => intersectionCallback?.([{ isIntersecting: false }]));

    expect(result.current.scrolled).toBe(true);
  });

  it("sets scrolled back to false when the sentinel re-enters the viewport", () => {
    const { result } = renderHook(() => useScrollShadow());
    const node = document.createElement("div");

    act(() => result.current.sentinelRef(node));
    act(() => intersectionCallback?.([{ isIntersecting: false }]));
    act(() => intersectionCallback?.([{ isIntersecting: true }]));

    expect(result.current.scrolled).toBe(false);
  });

  it("disconnects the observer and resets state when the sentinel detaches", () => {
    const { result } = renderHook(() => useScrollShadow());
    const node = document.createElement("div");

    act(() => result.current.sentinelRef(node));
    act(() => intersectionCallback?.([{ isIntersecting: false }]));
    act(() => result.current.sentinelRef(null));

    expect(disconnect).toHaveBeenCalled();
    expect(result.current.scrolled).toBe(false);
  });

  it("stays false when IntersectionObserver is unavailable", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("IntersectionObserver", undefined);
    const { result } = renderHook(() => useScrollShadow());
    const node = document.createElement("div");

    act(() => result.current.sentinelRef(node));

    expect(result.current.scrolled).toBe(false);
  });
});
