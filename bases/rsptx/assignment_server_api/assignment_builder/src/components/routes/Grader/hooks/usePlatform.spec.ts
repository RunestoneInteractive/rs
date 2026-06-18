import { renderHook } from "@testing-library/react";
import {
  altKeyLabel,
  detectPlatform,
  modKeyLabel,
  shiftKeyLabel,
  usePlatform
} from "./usePlatform";

describe("detectPlatform", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true
    });
  });

  it("returns 'other' when navigator is undefined", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      configurable: true,
      writable: true
    });
    expect(detectPlatform()).toBe("other");
  });

  it("returns 'mac' when platform contains 'Mac'", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "", platform: "MacIntel", userAgentData: null },
      configurable: true,
      writable: true
    });
    expect(detectPlatform()).toBe("mac");
  });

  it("returns 'mac' when platform contains 'iPhone'", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "", platform: "iPhone", userAgentData: null },
      configurable: true,
      writable: true
    });
    expect(detectPlatform()).toBe("mac");
  });

  it("returns 'mac' when platform contains 'iPad'", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "", platform: "iPad", userAgentData: null },
      configurable: true,
      writable: true
    });
    expect(detectPlatform()).toBe("mac");
  });

  it("returns 'mac' when platform contains 'iPod'", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "", platform: "iPod", userAgentData: null },
      configurable: true,
      writable: true
    });
    expect(detectPlatform()).toBe("mac");
  });

  it("returns 'mac' when userAgentData.platform is 'macOS'", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent: "",
        platform: "",
        userAgentData: { platform: "macOS" }
      },
      configurable: true,
      writable: true
    });
    expect(detectPlatform()).toBe("mac");
  });

  it("returns 'mac' when userAgent contains 'Mac' (case-insensitive)", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
        platform: "",
        userAgentData: null
      },
      configurable: true,
      writable: true
    });
    expect(detectPlatform()).toBe("mac");
  });

  it("returns 'other' for Windows platform", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        platform: "Win32",
        userAgentData: null
      },
      configurable: true,
      writable: true
    });
    expect(detectPlatform()).toBe("other");
  });

  it("returns 'other' for Linux platform", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
        platform: "Linux x86_64",
        userAgentData: null
      },
      configurable: true,
      writable: true
    });
    expect(detectPlatform()).toBe("other");
  });

  it("returns 'other' when both platform and userAgent are empty strings", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "", platform: "", userAgentData: null },
      configurable: true,
      writable: true
    });
    expect(detectPlatform()).toBe("other");
  });
});

describe("usePlatform", () => {
  it("returns a valid Platform value ('mac' or 'other')", () => {
    const { result } = renderHook(() => usePlatform());
    expect(["mac", "other"]).toContain(result.current);
  });

  it("returns the same value as detectPlatform", () => {
    const { result } = renderHook(() => usePlatform());
    expect(result.current).toBe(detectPlatform());
  });
});

describe("modKeyLabel", () => {
  it("returns the command symbol for mac platform", () => {
    expect(modKeyLabel("mac")).toBe("⌘");
  });

  it("returns 'Ctrl' for non-mac platform", () => {
    expect(modKeyLabel("other")).toBe("Ctrl");
  });
});

describe("altKeyLabel", () => {
  it("returns the option symbol for mac platform", () => {
    expect(altKeyLabel("mac")).toBe("⌥");
  });

  it("returns 'Alt' for non-mac platform", () => {
    expect(altKeyLabel("other")).toBe("Alt");
  });
});

describe("shiftKeyLabel", () => {
  it("is the shift symbol regardless of platform", () => {
    expect(shiftKeyLabel).toBe("⇧");
  });
});
