import "@testing-library/jest-dom";

/**
 * Provide Web Storage when the runtime does not.
 *
 * Node defines `globalThis.localStorage` as a native getter that returns
 * `undefined` unless the process was started with `--localstorage-file`, and
 * vitest's jsdom environment does not override that pre-existing native
 * accessor when it copies jsdom's globals across. The result is that
 * `localStorage` is undefined inside tests even though jsdom itself provides a
 * perfectly good one.
 *
 * The replacement has to be a genuine jsdom `Storage`, not a hand-rolled
 * object: `new StorageEvent("storage", { storageArea })` brand-checks its
 * argument and rejects anything else, and `Storage` itself is not directly
 * constructable. Borrowing the storage from a throwaway JSDOM satisfies that
 * check, because the brand is carried by the jsdom module rather than by the
 * individual window.
 *
 * Reading the storage from jsdom's `window` preserves the genuine `Storage`
 * implementation while replacing only Node's conflicting global accessor.
 * Remove this once vitest populates the jsdom value over Node's.
 */
const installStorage = () => {
  const missing = (["localStorage", "sessionStorage"] as const).filter(
    (name) => typeof (globalThis as Record<string, unknown>)[name] === "undefined"
  );
  if (missing.length === 0) {
    return;
  }

  for (const name of missing) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: window[name]
    });
  }
};

installStorage();

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false
      }) as unknown as MediaQueryList;
  }

  if (!("ResizeObserver" in window)) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
