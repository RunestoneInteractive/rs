import { renderHook } from "@testing-library/react";
import { useEnsureEbookConfigForGrader } from "./useEnsureEbookConfigForGrader";

type WindowWithEbookConfig = Window & typeof globalThis & { eBookConfig?: Record<string, unknown> };

const w = window as WindowWithEbookConfig;

describe("useEnsureEbookConfigForGrader", () => {
  beforeEach(() => {
    delete w.eBookConfig;
  });

  afterEach(() => {
    delete w.eBookConfig;
  });

  it("creates eBookConfig on window when it does not exist", () => {
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig).toBeDefined();
  });

  it("sets useRunestoneServices to true when not previously set", () => {
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.useRunestoneServices).toBe(true);
  });

  it("preserves useRunestoneServices as false when explicitly set to false", () => {
    w.eBookConfig = { useRunestoneServices: false };
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.useRunestoneServices).toBe(false);
  });

  it("sets isLoggedIn to true when not previously set", () => {
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.isLoggedIn).toBe(true);
  });

  it("preserves isLoggedIn as false when explicitly set to false", () => {
    w.eBookConfig = { isLoggedIn: false };
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.isLoggedIn).toBe(false);
  });

  it("sets new_server_prefix to /ns when not previously set", () => {
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.new_server_prefix).toBe("/ns");
  });

  it("preserves an existing new_server_prefix value", () => {
    w.eBookConfig = { new_server_prefix: "/custom" };
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.new_server_prefix).toBe("/custom");
  });

  it("sets app to /runestone when not previously set", () => {
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.app).toBe("/runestone");
  });

  it("preserves an existing app value", () => {
    w.eBookConfig = { app: "/myapp" };
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.app).toBe("/myapp");
  });

  it("sets python3 to true when not previously set", () => {
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.python3).toBe(true);
  });

  it("preserves python3 as false when explicitly set to false", () => {
    w.eBookConfig = { python3: false };
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.python3).toBe(false);
  });

  it("sets course to empty string when not previously set", () => {
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.course).toBe("");
  });

  it("preserves an existing course value", () => {
    w.eBookConfig = { course: "cs101" };
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.course).toBe("cs101");
  });

  it("sets basecourse to empty string when not previously set", () => {
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.basecourse).toBe("");
  });

  it("preserves an existing basecourse value", () => {
    w.eBookConfig = { basecourse: "thinkcspy" };
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.basecourse).toBe("thinkcspy");
  });

  it("sets email to instructor when neither email nor username is set", () => {
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.email).toBe("instructor");
  });

  it("uses username as email fallback when email is not set but username is", () => {
    w.eBookConfig = { username: "alice" };
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.email).toBe("alice");
  });

  it("preserves an existing email value when email is already set", () => {
    w.eBookConfig = { email: "bob@example.com", username: "bob" };
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig!.email).toBe("bob@example.com");
  });

  it("preserves pre-existing eBookConfig object reference when already present", () => {
    const existing: Record<string, unknown> = { course: "bio101" };
    w.eBookConfig = existing;
    renderHook(() => useEnsureEbookConfigForGrader());
    expect(w.eBookConfig).toBe(existing);
  });

  it("sets all defaults at once on a fresh window object", () => {
    renderHook(() => useEnsureEbookConfigForGrader());
    const cfg = w.eBookConfig!;
    expect(cfg.useRunestoneServices).toBe(true);
    expect(cfg.isLoggedIn).toBe(true);
    expect(cfg.new_server_prefix).toBe("/ns");
    expect(cfg.app).toBe("/runestone");
    expect(cfg.python3).toBe(true);
    expect(cfg.course).toBe("");
    expect(cfg.basecourse).toBe("");
    expect(cfg.email).toBe("instructor");
  });
});
