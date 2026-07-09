import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";

import { useMatchingConnections } from "./index";

import { CONNECTION_TOAST_COPY } from "../../../shared/connections";
import type { MatchingData } from "../types";

vi.mock("../MatchingExercise.module.css", () => ({
  default: {
    columnsContent: "columnsContent",
    column: "column"
  }
}));

const notifyShow = vi.fn();

vi.mock("@/components/ui/notify", () => ({
  notify: {
    show: (...args: unknown[]) => notifyShow(...args)
  }
}));

const makeFormData = (correctAnswers: string[][] = []): MatchingData => ({
  left: [{ id: "left-1", label: "A" }],
  right: [{ id: "right-1", label: "B" }],
  correctAnswers,
  feedback: ""
});

const makeProps = (formData: MatchingData, updateFormData = vi.fn()) => ({
  formData,
  updateFormData,
  containerRef: createRef<HTMLDivElement>()
});

beforeEach(() => {
  notifyShow.mockClear();
});

describe("useMatchingConnections", () => {
  describe("generatePath", () => {
    it("returns a cubic bezier SVG path string from start to end points", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));
      const path = result.current.generatePath({ x: 0, y: 0 }, { x: 120, y: 60 });

      expect(path).toMatch(/^M 0 0 C/);
      expect(path).toContain("120 60");
    });

    it("places control points at one-third and two-thirds of the horizontal distance", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));
      const path = result.current.generatePath({ x: 0, y: 10 }, { x: 90, y: 50 });

      expect(path).toBe("M 0 10 C 30 10, 60 50, 90 50");
    });

    it("handles zero horizontal distance without errors", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));
      const path = result.current.generatePath({ x: 50, y: 20 }, { x: 50, y: 80 });

      expect(path).toBe("M 50 20 C 50 20, 50 80, 50 80");
    });

    it("handles negative horizontal distance (right-to-left)", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));
      const path = result.current.generatePath({ x: 100, y: 0 }, { x: 10, y: 0 });

      expect(path).toBe("M 100 0 C 70 0, 40 0, 10 0");
    });
  });

  describe("initial state", () => {
    it("starts with no active source", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));
      expect(result.current.activeSource).toBeNull();
    });

    it("starts with mouse position at origin", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));
      expect(result.current.mousePosition).toEqual({ x: 0, y: 0 });
    });

    it("starts with hasMovedEnough as false", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));
      expect(result.current.hasMovedEnough).toBe(false);
    });

    it("starts with forceRedraw at 0", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));
      expect(result.current.forceRedraw).toBe(0);
    });
  });

  describe("triggerConnectionsRedraw", () => {
    it("increments forceRedraw on each call", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));

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
    it("sets the active source to the given id", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));

      act(() => {
        result.current.handleStartConnection("left-1");
      });

      expect(result.current.activeSource).toBe("left-1");
    });

    it("resets hasMovedEnough to false when starting a new connection", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));

      act(() => {
        result.current.handleStartConnection("left-1");
      });

      expect(result.current.hasMovedEnough).toBe(false);
    });

    it("accepts right-side ids as the active source", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));

      act(() => {
        result.current.handleStartConnection("right-1");
      });

      expect(result.current.activeSource).toBe("right-1");
    });
  });

  describe("handleCompleteConnection", () => {
    it("does nothing when there is no active source", () => {
      const updateFormData = vi.fn();
      const { result } = renderHook(() =>
        useMatchingConnections(makeProps(makeFormData(), updateFormData))
      );

      act(() => {
        result.current.handleCompleteConnection("right-1");
      });

      expect(updateFormData).not.toHaveBeenCalled();
    });

    it("shows a warning and clears active source when source and target are on the same side", () => {
      const updateFormData = vi.fn();

      const { result } = renderHook(() =>
        useMatchingConnections(makeProps(makeFormData(), updateFormData))
      );

      act(() => {
        result.current.handleStartConnection("left-1");
      });

      act(() => {
        result.current.handleCompleteConnection("left-2");
      });

      expect(notifyShow).toHaveBeenCalledWith(
        expect.objectContaining({
          color: "yellow",
          title: CONNECTION_TOAST_COPY.sameSideTitle,
          message: CONNECTION_TOAST_COPY.sameSideMessage
        })
      );
      expect(result.current.activeSource).toBeNull();
      expect(updateFormData).not.toHaveBeenCalled();
    });

    it("shows a warning when the same connection already exists", () => {
      const updateFormData = vi.fn();
      const existingAnswers: string[][] = [["left-1", "right-1"]];

      const { result } = renderHook(() =>
        useMatchingConnections(makeProps(makeFormData(existingAnswers), updateFormData))
      );

      act(() => {
        result.current.handleStartConnection("left-1");
      });

      act(() => {
        result.current.handleCompleteConnection("right-1");
      });

      expect(notifyShow).toHaveBeenCalledWith(
        expect.objectContaining({
          color: "yellow",
          title: CONNECTION_TOAST_COPY.duplicateTitle,
          message: CONNECTION_TOAST_COPY.duplicateMessage
        })
      );
      expect(updateFormData).not.toHaveBeenCalled();
      expect(result.current.activeSource).toBeNull();
    });

    it("adds a new left-right connection and clears the active source", () => {
      const updateFormData = vi.fn();
      const { result } = renderHook(() =>
        useMatchingConnections(makeProps(makeFormData(), updateFormData))
      );

      act(() => {
        result.current.handleStartConnection("left-1");
      });

      act(() => {
        result.current.handleCompleteConnection("right-1");
      });

      expect(updateFormData).toHaveBeenCalledWith("correctAnswers", [["left-1", "right-1"]]);
      expect(result.current.activeSource).toBeNull();
    });

    it("normalizes a right-to-left connection to [left, right] order", () => {
      const updateFormData = vi.fn();
      const { result } = renderHook(() =>
        useMatchingConnections(makeProps(makeFormData(), updateFormData))
      );

      act(() => {
        result.current.handleStartConnection("right-1");
      });

      act(() => {
        result.current.handleCompleteConnection("left-1");
      });

      expect(updateFormData).toHaveBeenCalledWith("correctAnswers", [["left-1", "right-1"]]);
    });

    it("appends to existing connections instead of replacing them", () => {
      const updateFormData = vi.fn();
      const existing: string[][] = [["left-2", "right-2"]];
      const { result } = renderHook(() =>
        useMatchingConnections(makeProps(makeFormData(existing), updateFormData))
      );

      act(() => {
        result.current.handleStartConnection("left-1");
      });

      act(() => {
        result.current.handleCompleteConnection("right-1");
      });

      expect(updateFormData).toHaveBeenCalledWith("correctAnswers", [
        ["left-2", "right-2"],
        ["left-1", "right-1"]
      ]);
    });
  });

  describe("cancelConnection", () => {
    it("clears the active source without completing a connection", () => {
      const updateFormData = vi.fn();
      const { result } = renderHook(() =>
        useMatchingConnections(makeProps(makeFormData(), updateFormData))
      );

      act(() => {
        result.current.handleStartConnection("left-1");
      });

      act(() => {
        result.current.cancelConnection();
      });

      expect(result.current.activeSource).toBeNull();
      expect(updateFormData).not.toHaveBeenCalled();
    });
  });

  describe("handleDeleteConnection", () => {
    it("removes the matching connection from correctAnswers", () => {
      const updateFormData = vi.fn();
      const answers: string[][] = [
        ["left-1", "right-1"],
        ["left-2", "right-2"]
      ];
      const { result } = renderHook(() =>
        useMatchingConnections(makeProps(makeFormData(answers), updateFormData))
      );

      act(() => {
        result.current.handleDeleteConnection("left-1", "right-1");
      });

      expect(updateFormData).toHaveBeenCalledWith("correctAnswers", [["left-2", "right-2"]]);
    });

    it("does nothing when the specified connection does not exist", () => {
      const updateFormData = vi.fn();
      const answers: string[][] = [["left-1", "right-1"]];
      const { result } = renderHook(() =>
        useMatchingConnections(makeProps(makeFormData(answers), updateFormData))
      );

      act(() => {
        result.current.handleDeleteConnection("left-99", "right-99");
      });

      expect(updateFormData).toHaveBeenCalledWith("correctAnswers", [["left-1", "right-1"]]);
    });

    it("triggers a connections redraw after deleting", () => {
      const updateFormData = vi.fn();
      const answers: string[][] = [["left-1", "right-1"]];
      const { result } = renderHook(() =>
        useMatchingConnections(makeProps(makeFormData(answers), updateFormData))
      );

      act(() => {
        result.current.handleDeleteConnection("left-1", "right-1");
      });

      expect(result.current.forceRedraw).toBe(1);
    });

    it("removes all matching connections leaving others intact", () => {
      const updateFormData = vi.fn();
      const answers: string[][] = [
        ["left-1", "right-1"],
        ["left-2", "right-2"],
        ["left-3", "right-3"]
      ];
      const { result } = renderHook(() =>
        useMatchingConnections(makeProps(makeFormData(answers), updateFormData))
      );

      act(() => {
        result.current.handleDeleteConnection("left-2", "right-2");
      });

      expect(updateFormData).toHaveBeenCalledWith("correctAnswers", [
        ["left-1", "right-1"],
        ["left-3", "right-3"]
      ]);
    });
  });

  describe("keyboard and mouse event cleanup", () => {
    it("clears active source when Escape is pressed while a connection is in progress", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));

      act(() => {
        result.current.handleStartConnection("left-1");
      });
      expect(result.current.activeSource).toBe("left-1");

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });

      expect(result.current.activeSource).toBeNull();
    });

    it("does not react to non-Escape keys", () => {
      const { result } = renderHook(() => useMatchingConnections(makeProps(makeFormData())));

      act(() => {
        result.current.handleStartConnection("left-1");
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      });

      expect(result.current.activeSource).toBe("left-1");
    });
  });
});
