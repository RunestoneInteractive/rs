import { renderHook } from "@testing-library/react";
import { useGraderHotkeys, GraderHotkeyHandlers } from "./useGraderHotkeys";

vi.mock("./usePlatform", () => ({
  detectPlatform: vi.fn(() => "other")
}));

import { detectPlatform } from "./usePlatform";

const mockDetectPlatform = detectPlatform as ReturnType<typeof vi.fn>;

const fireKeyDown = (
  key: string,
  opts: Partial<KeyboardEventInit> = {},
  target: EventTarget = document
) => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts });
  Object.defineProperty(event, "target", { value: target, writable: false });
  document.dispatchEvent(event);
  return event;
};

const makeInput = (tag: "INPUT" | "TEXTAREA" | "SELECT"): HTMLElement => {
  const el = document.createElement(tag);
  return el;
};

describe("useGraderHotkeys", () => {
  beforeEach(() => {
    mockDetectPlatform.mockReturnValue("other");
  });

  it("registers a keydown listener on mount and removes it on unmount", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useGraderHotkeys({}));

    expect(add).toHaveBeenCalledWith("keydown", expect.any(Function));

    unmount();

    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));

    add.mockRestore();
    remove.mockRestore();
  });

  it("does not register a listener when enabled is false", () => {
    const add = vi.spyOn(document, "addEventListener");

    renderHook(() => useGraderHotkeys({}, { enabled: false }));

    expect(add).not.toHaveBeenCalledWith("keydown", expect.any(Function));

    add.mockRestore();
  });

  describe("navigation keys — non-input target", () => {
    it("calls next on j key", () => {
      const handlers: GraderHotkeyHandlers = { next: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("j");

      expect(handlers.next).toHaveBeenCalledOnce();
    });

    it("calls next on ArrowDown key", () => {
      const handlers: GraderHotkeyHandlers = { next: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("ArrowDown");

      expect(handlers.next).toHaveBeenCalledOnce();
    });

    it("calls prev on k key", () => {
      const handlers: GraderHotkeyHandlers = { prev: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("k");

      expect(handlers.prev).toHaveBeenCalledOnce();
    });

    it("calls prev on ArrowUp key", () => {
      const handlers: GraderHotkeyHandlers = { prev: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("ArrowUp");

      expect(handlers.prev).toHaveBeenCalledOnce();
    });

    it("calls nextAttempt on ArrowRight key", () => {
      const handlers: GraderHotkeyHandlers = { nextAttempt: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("ArrowRight");

      expect(handlers.nextAttempt).toHaveBeenCalledOnce();
    });

    it("calls prevAttempt on ArrowLeft key", () => {
      const handlers: GraderHotkeyHandlers = { prevAttempt: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("ArrowLeft");

      expect(handlers.prevAttempt).toHaveBeenCalledOnce();
    });

    it("calls focusGrade on g key", () => {
      const handlers: GraderHotkeyHandlers = { focusGrade: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("g");

      expect(handlers.focusGrade).toHaveBeenCalledOnce();
    });

    it("calls focusComment on c key", () => {
      const handlers: GraderHotkeyHandlers = { focusComment: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("c");

      expect(handlers.focusComment).toHaveBeenCalledOnce();
    });

    it("calls toggleHideGraded on h key", () => {
      const handlers: GraderHotkeyHandlers = { toggleHideGraded: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("h");

      expect(handlers.toggleHideGraded).toHaveBeenCalledOnce();
    });

    it("calls openHelp on ? key", () => {
      const handlers: GraderHotkeyHandlers = { openHelp: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("?");

      expect(handlers.openHelp).toHaveBeenCalledOnce();
    });
  });

  describe("input target — keys are suppressed", () => {
    it("does not call next when target is INPUT", () => {
      const handlers: GraderHotkeyHandlers = { next: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("j", {}, makeInput("INPUT"));

      expect(handlers.next).not.toHaveBeenCalled();
    });

    it("does not call prev when target is TEXTAREA", () => {
      const handlers: GraderHotkeyHandlers = { prev: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("k", {}, makeInput("TEXTAREA"));

      expect(handlers.prev).not.toHaveBeenCalled();
    });

    it("does not call nextAttempt when target is SELECT", () => {
      const handlers: GraderHotkeyHandlers = { nextAttempt: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("ArrowRight", {}, makeInput("SELECT"));

      expect(handlers.nextAttempt).not.toHaveBeenCalled();
    });

    it("does not call openHelp when target is INPUT and key is ?", () => {
      const handlers: GraderHotkeyHandlers = { openHelp: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("?", {}, makeInput("INPUT"));

      expect(handlers.openHelp).not.toHaveBeenCalled();
    });
  });

  describe("modifier key — keys are suppressed (non-mac uses ctrlKey)", () => {
    it("does not call next when ctrlKey is held on non-mac", () => {
      mockDetectPlatform.mockReturnValue("other");
      const handlers: GraderHotkeyHandlers = { next: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("j", { ctrlKey: true });

      expect(handlers.next).not.toHaveBeenCalled();
    });

    it("does not call prev when ctrlKey is held on non-mac", () => {
      mockDetectPlatform.mockReturnValue("other");
      const handlers: GraderHotkeyHandlers = { prev: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("k", { ctrlKey: true });

      expect(handlers.prev).not.toHaveBeenCalled();
    });

    it("does not call next when altKey is held", () => {
      const handlers: GraderHotkeyHandlers = { next: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("j", { altKey: true });

      expect(handlers.next).not.toHaveBeenCalled();
    });
  });

  describe("mac platform — metaKey acts as modifier", () => {
    it("does not call next when metaKey is held on mac", () => {
      mockDetectPlatform.mockReturnValue("mac");
      const handlers: GraderHotkeyHandlers = { next: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("j", { metaKey: true });

      expect(handlers.next).not.toHaveBeenCalled();
    });

    it("calls next on j without metaKey on mac", () => {
      mockDetectPlatform.mockReturnValue("mac");
      const handlers: GraderHotkeyHandlers = { next: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("j");

      expect(handlers.next).toHaveBeenCalledOnce();
    });

    it("ctrlKey does not block keys on mac (only metaKey is modifier)", () => {
      mockDetectPlatform.mockReturnValue("mac");
      const handlers: GraderHotkeyHandlers = { next: vi.fn() };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("j", { ctrlKey: true });

      expect(handlers.next).toHaveBeenCalledOnce();
    });
  });

  describe("optional handlers — no crash when handler is undefined", () => {
    it("does not throw when next is not provided", () => {
      renderHook(() => useGraderHotkeys({}));
      expect(() => fireKeyDown("j")).not.toThrow();
    });

    it("does not throw when prev is not provided", () => {
      renderHook(() => useGraderHotkeys({}));
      expect(() => fireKeyDown("k")).not.toThrow();
    });

    it("does not throw when openHelp is not provided", () => {
      renderHook(() => useGraderHotkeys({}));
      expect(() => fireKeyDown("?")).not.toThrow();
    });

    it("does not throw when focusGrade is not provided", () => {
      renderHook(() => useGraderHotkeys({}));
      expect(() => fireKeyDown("g")).not.toThrow();
    });

    it("does not throw when focusComment is not provided", () => {
      renderHook(() => useGraderHotkeys({}));
      expect(() => fireKeyDown("c")).not.toThrow();
    });

    it("does not throw when toggleHideGraded is not provided", () => {
      renderHook(() => useGraderHotkeys({}));
      expect(() => fireKeyDown("h")).not.toThrow();
    });
  });

  describe("unrecognized keys are ignored", () => {
    it("does not call any handler for an unknown key", () => {
      const handlers: GraderHotkeyHandlers = {
        next: vi.fn(),
        prev: vi.fn(),
        nextAttempt: vi.fn(),
        prevAttempt: vi.fn(),
        focusGrade: vi.fn(),
        focusComment: vi.fn(),
        toggleHideGraded: vi.fn(),
        openHelp: vi.fn()
      };
      renderHook(() => useGraderHotkeys(handlers));

      fireKeyDown("z");

      for (const handler of Object.values(handlers)) {
        expect(handler).not.toHaveBeenCalled();
      }
    });
  });
});
