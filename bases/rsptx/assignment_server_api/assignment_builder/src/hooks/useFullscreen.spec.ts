import React from "react";
import { renderHook, act } from "@testing-library/react";
import screenfull from "screenfull";
import { useFullscreen } from "./useFullscreen";

vi.mock("screenfull", () => {
  const changeHandlers: Array<(event: Event) => void> = [];

  return {
    default: {
      isEnabled: true,
      isFullscreen: false,
      request: vi.fn().mockResolvedValue(undefined),
      exit: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((name: string, handler: (event: Event) => void) => {
        if (name === "change") changeHandlers.push(handler);
      }),
      off: vi.fn((name: string, handler: (event: Event) => void) => {
        if (name === "change") {
          const idx = changeHandlers.indexOf(handler);
          if (idx !== -1) changeHandlers.splice(idx, 1);
        }
      }),
      _changeHandlers: changeHandlers
    }
  };
});

const screenfullMock = screenfull as unknown as {
  isEnabled: boolean;
  isFullscreen: boolean;
  request: ReturnType<typeof vi.fn>;
  exit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  _changeHandlers: Array<(event: Event) => void>;
};

function triggerChange() {
  screenfullMock._changeHandlers.forEach((h) => h(new Event("fullscreenchange")));
}

describe("useFullscreen", () => {
  beforeEach(() => {
    screenfullMock.isEnabled = true;
    screenfullMock.isFullscreen = false;
    screenfullMock.request.mockResolvedValue(undefined);
    screenfullMock.exit.mockResolvedValue(undefined);
  });

  describe("initial state", () => {
    it("returns isFullscreen as false initially", () => {
      const { result } = renderHook(() => useFullscreen());
      expect(result.current.isFullscreen).toBe(false);
    });

    it("returns isSupported as true when screenfull is enabled", () => {
      const { result } = renderHook(() => useFullscreen());
      expect(result.current.isSupported).toBe(true);
    });

    it("returns isSupported as false when screenfull is not enabled", () => {
      screenfullMock.isEnabled = false;
      const { result } = renderHook(() => useFullscreen());
      expect(result.current.isSupported).toBe(false);
    });

    it("exposes toggleFullscreen, enterFullscreen, and exitFullscreen as functions", () => {
      const { result } = renderHook(() => useFullscreen());
      expect(typeof result.current.toggleFullscreen).toBe("function");
      expect(typeof result.current.enterFullscreen).toBe("function");
      expect(typeof result.current.exitFullscreen).toBe("function");
    });
  });

  describe("event listener registration", () => {
    it("registers a change listener on mount when screenfull is enabled", () => {
      renderHook(() => useFullscreen());
      expect(screenfullMock.on).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("does not register a change listener when screenfull is not enabled", () => {
      screenfullMock.isEnabled = false;
      renderHook(() => useFullscreen());
      expect(screenfullMock.on).not.toHaveBeenCalled();
    });

    it("removes the change listener on unmount", () => {
      const { unmount } = renderHook(() => useFullscreen());
      unmount();
      expect(screenfullMock.off).toHaveBeenCalledWith("change", expect.any(Function));
    });
  });

  describe("isFullscreen state tracks screenfull changes", () => {
    it("updates isFullscreen to true when screenfull reports fullscreen active", async () => {
      const { result } = renderHook(() => useFullscreen());

      screenfullMock.isFullscreen = true;
      await act(async () => {
        triggerChange();
      });

      expect(result.current.isFullscreen).toBe(true);
    });

    it("updates isFullscreen to false when screenfull reports fullscreen exited", async () => {
      screenfullMock.isFullscreen = true;
      const { result } = renderHook(() => useFullscreen());

      screenfullMock.isFullscreen = true;
      await act(async () => {
        triggerChange();
      });

      screenfullMock.isFullscreen = false;
      await act(async () => {
        triggerChange();
      });

      expect(result.current.isFullscreen).toBe(false);
    });
  });

  describe("enterFullscreen", () => {
    it("calls screenfull.request with document.documentElement when no ref is provided", async () => {
      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(screenfullMock.request).toHaveBeenCalledWith(document.documentElement);
    });

    it("calls screenfull.request with the ref element when a ref is provided", async () => {
      const element = document.createElement("div");
      const ref = { current: element };

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(screenfullMock.request).toHaveBeenCalledWith(element);
    });

    it("falls back to document.documentElement when ref.current is null", async () => {
      const ref = { current: null } as unknown as React.RefObject<HTMLElement>;

      const { result } = renderHook(() => useFullscreen(ref));

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(screenfullMock.request).toHaveBeenCalledWith(document.documentElement);
    });

    it("does nothing when screenfull is not enabled", async () => {
      screenfullMock.isEnabled = false;

      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(screenfullMock.request).not.toHaveBeenCalled();
    });

    it("logs an error and does not throw when screenfull.request rejects", async () => {
      screenfullMock.request.mockRejectedValueOnce(new Error("request denied"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.enterFullscreen();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("exitFullscreen", () => {
    it("calls screenfull.exit", async () => {
      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.exitFullscreen();
      });

      expect(screenfullMock.exit).toHaveBeenCalled();
    });

    it("does nothing when screenfull is not enabled", async () => {
      screenfullMock.isEnabled = false;

      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.exitFullscreen();
      });

      expect(screenfullMock.exit).not.toHaveBeenCalled();
    });

    it("logs an error and does not throw when screenfull.exit rejects", async () => {
      screenfullMock.exit.mockRejectedValueOnce(new Error("exit denied"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.exitFullscreen();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("toggleFullscreen", () => {
    it("calls enterFullscreen when not currently in fullscreen", async () => {
      const { result } = renderHook(() => useFullscreen());

      await act(async () => {
        await result.current.toggleFullscreen();
      });

      expect(screenfullMock.request).toHaveBeenCalledWith(document.documentElement);
      expect(screenfullMock.exit).not.toHaveBeenCalled();
    });

    it("calls exitFullscreen when currently in fullscreen", async () => {
      const { result } = renderHook(() => useFullscreen());

      screenfullMock.isFullscreen = true;
      await act(async () => {
        triggerChange();
      });

      await act(async () => {
        await result.current.toggleFullscreen();
      });

      expect(screenfullMock.exit).toHaveBeenCalled();
      expect(screenfullMock.request).not.toHaveBeenCalled();
    });
  });
});
