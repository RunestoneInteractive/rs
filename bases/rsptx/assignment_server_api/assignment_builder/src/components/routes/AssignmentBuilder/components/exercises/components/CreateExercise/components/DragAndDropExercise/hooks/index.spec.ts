import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";
import { useDragAndDropConnections } from "./index";

import { CONNECTION_TOAST_COPY } from "../../../shared/connections";

vi.mock("../DragAndDropExercise.module.css", () => ({
  default: {
    columnsContent: "columnsContent",
    column: "column",
    rightTarget: "rightTarget"
  }
}));

const notifyShow = vi.fn();

vi.mock("@/components/ui/notify", () => ({
  notify: {
    show: (...args: unknown[]) => notifyShow(...args)
  }
}));

function makeContainerRef(scrollableEl?: Element | null) {
  const ref = createRef<HTMLDivElement>();
  const div = document.createElement("div");

  if (scrollableEl !== undefined) {
    vi.spyOn(div, "querySelector").mockReturnValue(scrollableEl as any);
  } else {
    vi.spyOn(div, "querySelector").mockReturnValue(null);
  }

  (ref as any).current = div;
  return ref;
}

function buildFormData(correctAnswers: string[][] = []) {
  return {
    left: [],
    right: [],
    correctAnswers,
    feedback: ""
  };
}

beforeEach(() => {
  notifyShow.mockClear();
});

describe("useDragAndDropConnections", () => {
  describe("initial state", () => {
    it("returns null activeSource, zero mousePosition, false hasMovedEnough, 0 forceRedraw on mount", () => {
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData: vi.fn(),
          containerRef: makeContainerRef(null)
        })
      );

      expect(result.current.activeSource).toBeNull();
      expect(result.current.mousePosition).toEqual({ x: 0, y: 0 });
      expect(result.current.hasMovedEnough).toBe(false);
      expect(result.current.forceRedraw).toBe(0);
    });
  });

  describe("triggerConnectionsRedraw", () => {
    it("increments forceRedraw by 1 on each call", () => {
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData: vi.fn(),
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        result.current.triggerConnectionsRedraw();
      });

      expect(result.current.forceRedraw).toBe(1);

      act(() => {
        result.current.triggerConnectionsRedraw();
      });

      expect(result.current.forceRedraw).toBe(2);
    });
  });

  describe("handleStartConnection", () => {
    it("sets activeSource to the provided sourceId", () => {
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData: vi.fn(),
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        result.current.handleStartConnection("block-1");
      });

      expect(result.current.activeSource).toBe("block-1");
    });

    it("resets hasMovedEnough to false when starting a new connection", () => {
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData: vi.fn(),
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        result.current.handleStartConnection("block-1");
      });

      expect(result.current.hasMovedEnough).toBe(false);
    });
  });

  describe("handleCompleteConnection", () => {
    it("does nothing when there is no active source", () => {
      const updateFormData = vi.fn();
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData,
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        result.current.handleCompleteConnection("block-2");
      });

      expect(updateFormData).not.toHaveBeenCalled();
    });

    it("adds a new connection and clears activeSource when the connection does not exist", () => {
      const updateFormData = vi.fn();
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData,
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        result.current.handleStartConnection("block-1");
      });

      act(() => {
        result.current.handleCompleteConnection("block-2");
      });

      expect(updateFormData).toHaveBeenCalledWith("correctAnswers", [["block-1", "block-2"]]);
      expect(result.current.activeSource).toBeNull();
    });

    it("shows a warning notification and clears activeSource when the connection already exists", () => {
      const updateFormData = vi.fn();

      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData([["block-1", "block-2"]]),
          updateFormData,
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        result.current.handleStartConnection("block-1");
      });

      act(() => {
        result.current.handleCompleteConnection("block-2");
      });

      expect(updateFormData).not.toHaveBeenCalled();
      expect(notifyShow).toHaveBeenCalledWith(
        expect.objectContaining({
          color: "yellow",
          title: CONNECTION_TOAST_COPY.duplicateTitle,
          message: CONNECTION_TOAST_COPY.duplicateMessage
        })
      );
      expect(result.current.activeSource).toBeNull();
    });

    it("allows connecting the same source to a different target even when one connection exists", () => {
      const updateFormData = vi.fn();
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData([["block-1", "block-2"]]),
          updateFormData,
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        result.current.handleStartConnection("block-1");
      });

      act(() => {
        result.current.handleCompleteConnection("block-3");
      });

      expect(updateFormData).toHaveBeenCalledWith("correctAnswers", [
        ["block-1", "block-2"],
        ["block-1", "block-3"]
      ]);
    });
  });

  describe("handleDeleteConnection", () => {
    it("removes the matching connection and calls updateFormData", () => {
      const updateFormData = vi.fn();
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData([
            ["a", "b"],
            ["a", "c"],
            ["d", "e"]
          ]),
          updateFormData,
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        result.current.handleDeleteConnection("a", "b");
      });

      expect(updateFormData).toHaveBeenCalledWith("correctAnswers", [
        ["a", "c"],
        ["d", "e"]
      ]);
    });

    it("does not remove connections when the pair does not match", () => {
      const updateFormData = vi.fn();
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData([["a", "b"]]),
          updateFormData,
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        result.current.handleDeleteConnection("x", "y");
      });

      expect(updateFormData).toHaveBeenCalledWith("correctAnswers", [["a", "b"]]);
    });

    it("triggers a connections redraw after deleting", () => {
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData([["a", "b"]]),
          updateFormData: vi.fn(),
          containerRef: makeContainerRef(null)
        })
      );

      const forceRedrawBefore = result.current.forceRedraw;

      act(() => {
        result.current.handleDeleteConnection("a", "b");
      });

      expect(result.current.forceRedraw).toBe(forceRedrawBefore + 1);
    });
  });

  describe("generatePath", () => {
    it("generates a cubic bezier SVG path string from start to end", () => {
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData: vi.fn(),
          containerRef: makeContainerRef(null)
        })
      );

      const path = result.current.generatePath({ x: 0, y: 100 }, { x: 300, y: 100 });

      expect(path).toMatch(/^M 0 100 C /);
      expect(path).toContain("300 100");
    });

    it("uses one-third of the horizontal distance for control points", () => {
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData: vi.fn(),
          containerRef: makeContainerRef(null)
        })
      );

      const path = result.current.generatePath({ x: 0, y: 0 }, { x: 300, y: 0 });

      expect(path).toBe("M 0 0 C 100 0, 200 0, 300 0");
    });

    it("handles negative x distance (end is to the left of start)", () => {
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData: vi.fn(),
          containerRef: makeContainerRef(null)
        })
      );

      const path = result.current.generatePath({ x: 300, y: 50 }, { x: 0, y: 50 });

      expect(path).toBe("M 300 50 C 200 50, 100 50, 0 50");
    });
  });

  describe("Escape key cancels active connection", () => {
    it("sets activeSource to null when Escape is pressed while a connection is in progress", () => {
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData: vi.fn(),
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        result.current.handleStartConnection("block-1");
      });

      expect(result.current.activeSource).toBe("block-1");

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });

      expect(result.current.activeSource).toBeNull();
    });

    it("does not affect state when Escape is pressed without an active connection", () => {
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData: vi.fn(),
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });

      expect(result.current.activeSource).toBeNull();
    });
  });

  describe("cancelConnection", () => {
    it("clears the active source without completing a connection", () => {
      const updateFormData = vi.fn();
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData,
          containerRef: makeContainerRef(null)
        })
      );

      act(() => {
        result.current.handleStartConnection("block-1");
      });

      act(() => {
        result.current.cancelConnection();
      });

      expect(result.current.activeSource).toBeNull();
      expect(updateFormData).not.toHaveBeenCalled();
    });
  });

  describe("getBlockPosition", () => {
    it("returns null when containerRef.current is null", () => {
      const containerRef = createRef<HTMLDivElement>();

      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData: vi.fn(),
          containerRef
        })
      );

      const position = result.current.getBlockPosition("block-1", true);

      expect(position).toBeNull();
    });

    it("returns null when the scrollable container is not found", () => {
      const { result } = renderHook(() =>
        useDragAndDropConnections({
          formData: buildFormData(),
          updateFormData: vi.fn(),
          containerRef: makeContainerRef(null)
        })
      );

      const position = result.current.getBlockPosition("block-1", true);

      expect(position).toBeNull();
    });
  });
});
