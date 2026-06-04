import { renderHook, act } from "@testing-library/react";

vi.mock("@store/grader/grader.logic.api", () => ({
  useSaveGradeMutation: vi.fn()
}));

vi.mock("../tour/GraderTourContext", () => ({
  useGraderTourContext: vi.fn()
}));

import { useSaveGradeMutation } from "@store/grader/grader.logic.api";
import { useGraderTourContext } from "../tour/GraderTourContext";
import { useAutoSaveGrade } from "./useAutoSaveGrade";

const mockUnwrap = vi.fn();
const mockSaveGrade = vi.fn();

const defaultArgs = {
  sid: "student1",
  assignmentId: 10,
  questionId: 5,
  questionName: "q1",
  maxPoints: 10,
  initialScore: 0,
  initialComment: ""
};

function setup(overrides: Partial<typeof defaultArgs> = {}, isDemo = false) {
  vi.mocked(useSaveGradeMutation).mockReturnValue([mockSaveGrade, {} as any]);
  vi.mocked(useGraderTourContext).mockReturnValue({
    isDemo,
    demoSelected: null,
    setDemoSelected: vi.fn(),
    setIsDemo: vi.fn()
  });

  return renderHook((props) => useAutoSaveGrade(props), {
    initialProps: { ...defaultArgs, ...overrides }
  });
}

describe("useAutoSaveGrade", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUnwrap.mockReset();
    mockSaveGrade.mockReset();
    mockUnwrap.mockResolvedValue({});
    mockSaveGrade.mockReturnValue({ unwrap: mockUnwrap });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("returns the initialScore and initialComment on first render", () => {
      const { result } = setup({ initialScore: 7, initialComment: "well done" });

      expect(result.current.score).toBe(7);
      expect(result.current.comment).toBe("well done");
    });

    it("starts with status idle", () => {
      const { result } = setup();

      expect(result.current.status).toBe("idle");
    });

    it("starts with isDirty false", () => {
      const { result } = setup();

      expect(result.current.isDirty).toBe(false);
    });

    it("starts with no errorMessage", () => {
      const { result } = setup();

      expect(result.current.errorMessage).toBeUndefined();
    });

    it("starts with no lastSavedAt", () => {
      const { result } = setup();

      expect(result.current.lastSavedAt).toBeUndefined();
    });
  });

  describe("setScore", () => {
    it("updates score and sets status to dirty", () => {
      const { result } = setup();

      act(() => {
        result.current.setScore(5);
      });

      expect(result.current.score).toBe(5);
      expect(result.current.status).toBe("dirty");
      expect(result.current.isDirty).toBe(true);
    });

    it("clamps score to maxPoints", () => {
      const { result } = setup({ maxPoints: 10 });

      act(() => {
        result.current.setScore(15);
      });

      expect(result.current.score).toBe(10);
    });

    it("clamps score to zero when negative", () => {
      const { result } = setup();

      act(() => {
        result.current.setScore(-5);
      });

      expect(result.current.score).toBe(0);
    });

    it("treats non-finite value as zero", () => {
      const { result } = setup();

      act(() => {
        result.current.setScore(NaN);
      });

      expect(result.current.score).toBe(0);
    });
  });

  describe("setComment", () => {
    it("updates comment and sets status to dirty", () => {
      const { result } = setup();

      act(() => {
        result.current.setComment("great work");
      });

      expect(result.current.comment).toBe("great work");
      expect(result.current.status).toBe("dirty");
      expect(result.current.isDirty).toBe(true);
    });
  });

  describe("revertTo", () => {
    it("restores score and comment and sets status to idle", () => {
      const { result } = setup();

      act(() => {
        result.current.setScore(8);
        result.current.setComment("changed");
      });

      act(() => {
        result.current.revertTo({ score: 3, comment: "original" });
      });

      expect(result.current.score).toBe(3);
      expect(result.current.comment).toBe("original");
      expect(result.current.status).toBe("idle");
      expect(result.current.isDirty).toBe(false);
    });

    it("clears errorMessage on revert", async () => {
      mockUnwrap.mockRejectedValueOnce({ message: "network error" });
      const { result } = setup();

      act(() => {
        result.current.setScore(5);
      });
      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.status).toBe("error");

      act(() => {
        result.current.revertTo({ score: 0, comment: "" });
      });

      expect(result.current.errorMessage).toBeUndefined();
      expect(result.current.status).toBe("idle");
    });
  });

  describe("saveNow", () => {
    it("calls saveGrade with correct payload and sets status to saved", async () => {
      const { result } = setup({ sid: "alice", questionName: "qA" });

      act(() => {
        result.current.setScore(6);
      });

      await act(async () => {
        await result.current.saveNow();
      });

      expect(mockSaveGrade).toHaveBeenCalledWith(
        expect.objectContaining({
          sid: "alice",
          div_id: "qA",
          score: 6,
          questionId: 5,
          assignmentId: 10
        })
      );
      expect(result.current.status).toBe("saved");
    });

    it("does not call saveGrade when sid is undefined", async () => {
      const { result } = setup({ sid: undefined });

      act(() => {
        result.current.setScore(4);
      });
      await act(async () => {
        await result.current.saveNow();
      });

      expect(mockSaveGrade).not.toHaveBeenCalled();
    });

    it("does not call saveGrade when values are unchanged from last saved", async () => {
      const { result } = setup({ initialScore: 3, initialComment: "hi" });

      await act(async () => {
        await result.current.saveNow();
      });

      expect(mockSaveGrade).not.toHaveBeenCalled();
      expect(result.current.status).toBe("idle");
    });

    it("sets status to error and stores errorMessage on failure", async () => {
      mockUnwrap.mockRejectedValueOnce({ message: "timeout" });
      const { result } = setup();

      act(() => {
        result.current.setScore(3);
      });
      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.status).toBe("error");
      expect(result.current.errorMessage).toBe("timeout");
    });

    it("prefers error.data.detail over message", async () => {
      mockUnwrap.mockRejectedValueOnce({ data: { detail: "forbidden" } });
      const { result } = setup();

      act(() => {
        result.current.setScore(3);
      });
      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.errorMessage).toBe("forbidden");
    });

    it("falls back to Save failed when error has no message or detail", async () => {
      mockUnwrap.mockRejectedValueOnce({});
      const { result } = setup();

      act(() => {
        result.current.setScore(2);
      });
      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.errorMessage).toBe("Save failed");
    });

    it("sets lastSavedAt after a successful save", async () => {
      const before = Date.now();
      const { result } = setup();

      act(() => {
        result.current.setScore(5);
      });
      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.lastSavedAt).toBeGreaterThanOrEqual(before);
    });

    it("invokes onSaved callback with correct info after save", async () => {
      const onSaved = vi.fn();
      const { result } = setup({ onSaved, initialScore: 0, initialComment: "" });

      act(() => {
        result.current.setScore(7);
        result.current.setComment("nice");
      });
      await act(async () => {
        await result.current.saveNow();
      });

      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          sid: "student1",
          questionId: 5,
          questionName: "q1",
          previous: { score: 0, comment: "" },
          next: { score: 7, comment: "nice" }
        })
      );
    });
  });

  describe("flush", () => {
    it("calls persist when status is dirty", async () => {
      const { result } = setup();

      act(() => {
        result.current.setScore(4);
      });

      expect(result.current.status).toBe("dirty");

      await act(async () => {
        await result.current.flush();
      });

      expect(mockSaveGrade).toHaveBeenCalled();
    });

    it("does not call saveGrade when status is not dirty", async () => {
      const { result } = setup();

      await act(async () => {
        await result.current.flush();
      });

      expect(mockSaveGrade).not.toHaveBeenCalled();
    });
  });

  describe("saved status auto-reset", () => {
    it("transitions from saved back to idle after 1500 ms", async () => {
      const { result } = setup();

      act(() => {
        result.current.setScore(5);
      });
      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.status).toBe("saved");

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.status).toBe("idle");
    });
  });

  describe("sid change resets state", () => {
    it("resets score and comment when sid prop changes", () => {
      const { result, rerender } = setup({
        sid: "alice",
        initialScore: 8,
        initialComment: "old"
      });

      act(() => {
        result.current.setScore(10);
        result.current.setComment("changed");
      });

      rerender({
        ...defaultArgs,
        sid: "bob",
        initialScore: 2,
        initialComment: "fresh"
      });

      expect(result.current.score).toBe(2);
      expect(result.current.comment).toBe("fresh");
      expect(result.current.status).toBe("idle");
    });
  });

  describe("demo mode", () => {
    it("does not call saveGrade in demo mode, resolves after delay", async () => {
      vi.useRealTimers();
      const { result } = setup({}, true);

      act(() => {
        result.current.setScore(5);
      });
      await act(async () => {
        await result.current.saveNow();
      });

      expect(mockSaveGrade).not.toHaveBeenCalled();
      vi.useFakeTimers();
    });

    it("still sets status to saved in demo mode", async () => {
      vi.useRealTimers();
      const { result } = setup({}, true);

      act(() => {
        result.current.setScore(5);
      });
      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.status).toBe("saved");
      vi.useFakeTimers();
    });
  });

  describe("isDirty", () => {
    it("is true when status is dirty", () => {
      const { result } = setup();

      act(() => {
        result.current.setScore(3);
      });

      expect(result.current.isDirty).toBe(true);
    });

    it("is false when status is idle", () => {
      const { result } = setup();

      expect(result.current.isDirty).toBe(false);
    });

    it("is false after a successful save and idle transition", async () => {
      const { result } = setup();

      act(() => {
        result.current.setScore(5);
      });
      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.isDirty).toBe(false);
    });
  });
});
