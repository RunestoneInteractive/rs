import { renderHook, act } from "@testing-library/react";

vi.mock("react-router-dom", () => ({
  useParams: vi.fn(),
  useNavigate: vi.fn()
}));

vi.mock("../tour/GraderTourContext", () => ({
  useGraderTourContext: vi.fn()
}));

import { useParams, useNavigate } from "react-router-dom";
import { useGraderTourContext } from "../tour/GraderTourContext";
import { useStudentNavigation } from "./useStudentNavigation";
import type { GraderStudentAnswer, GraderQuestionStats } from "@store/grader/grader.logic.api";

const mockNavigate = vi.fn();
const mockSetDemoSelected = vi.fn();

function makeAnswer(
  sid: string,
  overrides: Partial<GraderStudentAnswer> = {}
): GraderStudentAnswer {
  return {
    sid,
    answer: "",
    attempts: 1,
    score: null,
    comment: null,
    max_points: 10,
    ...overrides
  };
}

function makeQuestion(
  id: number,
  overrides: Partial<GraderQuestionStats> = {}
): GraderQuestionStats {
  return {
    id,
    name: `q${id}`,
    question_type: "mchoice",
    points: 10,
    answered_count: 0,
    correct_count: 0,
    average_score: 0,
    ...overrides
  };
}

function setupMocks(
  opts: {
    assignmentId?: number;
    questionId?: number;
    sid?: string;
    isDemo?: boolean;
    demoSid?: string;
  } = {}
) {
  const { assignmentId = 1, questionId = 2, sid = "alice", isDemo = false, demoSid } = opts;

  vi.mocked(useParams).mockReturnValue({
    assignmentId: String(assignmentId),
    questionId: String(questionId),
    sid
  });
  vi.mocked(useNavigate).mockReturnValue(mockNavigate);

  const demoAnswer = demoSid ? makeAnswer(demoSid) : null;
  vi.mocked(useGraderTourContext).mockReturnValue({
    isDemo,
    demoSelected: demoAnswer,
    setDemoSelected: mockSetDemoSelected,
    setIsDemo: vi.fn()
  });
}

const answers = [makeAnswer("alice"), makeAnswer("bob"), makeAnswer("charlie")];

describe("useStudentNavigation", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSetDemoSelected.mockReset();
  });

  describe("currentIndex and current", () => {
    it("returns the correct currentIndex when sid matches an answer", () => {
      setupMocks({ sid: "bob" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.currentIndex).toBe(1);
      expect(result.current.current?.sid).toBe("bob");
    });

    it("returns -1 currentIndex when sid does not match any answer", () => {
      setupMocks({ sid: "unknown" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.current).toBeUndefined();
    });

    it("returns -1 currentIndex when sid param is absent", () => {
      vi.mocked(useParams).mockReturnValue({ assignmentId: "1", questionId: "2" });
      vi.mocked(useNavigate).mockReturnValue(mockNavigate);
      vi.mocked(useGraderTourContext).mockReturnValue({
        isDemo: false,
        demoSelected: null,
        setDemoSelected: mockSetDemoSelected,
        setIsDemo: vi.fn()
      });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.currentIndex).toBe(-1);
    });

    it("returns total equal to answers length", () => {
      setupMocks({ sid: "alice" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.total).toBe(3);
    });
  });

  describe("hasPrev / hasNext — student-only navigation (no questions)", () => {
    it("hasPrev is false for the first student", () => {
      setupMocks({ sid: "alice" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.hasPrev).toBe(false);
    });

    it("hasNext is true for the first student", () => {
      setupMocks({ sid: "alice" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.hasNext).toBe(true);
    });

    it("hasPrev is true for a middle student", () => {
      setupMocks({ sid: "bob" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.hasPrev).toBe(true);
    });

    it("hasNext is true for a middle student", () => {
      setupMocks({ sid: "bob" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.hasNext).toBe(true);
    });

    it("hasNext is false for the last student", () => {
      setupMocks({ sid: "charlie" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.hasNext).toBe(false);
    });

    it("hasPrev is true for the last student", () => {
      setupMocks({ sid: "charlie" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.hasPrev).toBe(true);
    });
  });

  describe("hasPrev / hasNext — with question navigation", () => {
    const questions = [makeQuestion(10), makeQuestion(20), makeQuestion(30)];

    it("hasPrev is true for first student when there is a previous question", () => {
      setupMocks({ sid: "alice", questionId: 20 });

      const { result } = renderHook(() => useStudentNavigation({ answers, questions }));

      expect(result.current.hasPrev).toBe(true);
    });

    it("hasNext is true for last student when there is a next question", () => {
      setupMocks({ sid: "charlie", questionId: 20 });

      const { result } = renderHook(() => useStudentNavigation({ answers, questions }));

      expect(result.current.hasNext).toBe(true);
    });

    it("hasPrev is false for first student on the first question", () => {
      setupMocks({ sid: "alice", questionId: 10 });

      const { result } = renderHook(() => useStudentNavigation({ answers, questions }));

      expect(result.current.hasPrev).toBe(false);
    });

    it("hasNext is false for last student on the last question", () => {
      setupMocks({ sid: "charlie", questionId: 30 });

      const { result } = renderHook(() => useStudentNavigation({ answers, questions }));

      expect(result.current.hasNext).toBe(false);
    });
  });

  describe("goTo", () => {
    it("navigates to the correct URL in normal mode", () => {
      setupMocks({ assignmentId: 5, questionId: 7, sid: "alice" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      act(() => {
        result.current.goTo("bob");
      });

      expect(mockNavigate).toHaveBeenCalledWith("/grader/5/questions/7/students/bob");
    });

    it("URL-encodes special characters in sid", () => {
      setupMocks({ assignmentId: 1, questionId: 2, sid: "alice" });

      const { result } = renderHook(() =>
        useStudentNavigation({ answers: [makeAnswer("user@domain.com")] })
      );

      act(() => {
        result.current.goTo("user@domain.com");
      });

      expect(mockNavigate).toHaveBeenCalledWith("/grader/1/questions/2/students/user%40domain.com");
    });

    it("calls setDemoSelected with matching answer in demo mode", () => {
      setupMocks({ isDemo: true, sid: "alice" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      act(() => {
        result.current.goTo("bob");
      });

      expect(mockSetDemoSelected).toHaveBeenCalledWith(expect.objectContaining({ sid: "bob" }));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("calls setDemoSelected with null when sid not found in demo mode", () => {
      setupMocks({ isDemo: true, sid: "alice" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      act(() => {
        result.current.goTo("nonexistent");
      });

      expect(mockSetDemoSelected).toHaveBeenCalledWith(null);
    });
  });

  describe("prev", () => {
    it("navigates to previous student when hasPrevStudent is true", () => {
      setupMocks({ assignmentId: 1, questionId: 2, sid: "bob" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      act(() => {
        result.current.prev();
      });

      expect(mockNavigate).toHaveBeenCalledWith("/grader/1/questions/2/students/alice");
    });

    it("navigates to previous question with selectLast when on first student", () => {
      const questions = [makeQuestion(10), makeQuestion(20)];
      setupMocks({ assignmentId: 1, questionId: 20, sid: "alice" });

      const { result } = renderHook(() => useStudentNavigation({ answers, questions }));

      act(() => {
        result.current.prev();
      });

      expect(mockNavigate).toHaveBeenCalledWith("/grader/1/questions/10", {
        state: { selectLast: true }
      });
    });

    it("does nothing when there is no prev student and no prev question", () => {
      setupMocks({ assignmentId: 1, questionId: 10, sid: "alice" });
      const questions = [makeQuestion(10)];

      const { result } = renderHook(() => useStudentNavigation({ answers, questions }));

      act(() => {
        result.current.prev();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("next", () => {
    it("navigates to next student when hasNextStudent is true", () => {
      setupMocks({ assignmentId: 1, questionId: 2, sid: "alice" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      act(() => {
        result.current.next();
      });

      expect(mockNavigate).toHaveBeenCalledWith("/grader/1/questions/2/students/bob");
    });

    it("navigates to next question when on last student", () => {
      const questions = [makeQuestion(10), makeQuestion(20)];
      setupMocks({ assignmentId: 1, questionId: 10, sid: "charlie" });

      const { result } = renderHook(() => useStudentNavigation({ answers, questions }));

      act(() => {
        result.current.next();
      });

      expect(mockNavigate).toHaveBeenCalledWith("/grader/1/questions/20", { state: undefined });
    });

    it("does nothing when on last student with no next question", () => {
      setupMocks({ assignmentId: 1, questionId: 20, sid: "charlie" });
      const questions = [makeQuestion(20)];

      const { result } = renderHook(() => useStudentNavigation({ answers, questions }));

      act(() => {
        result.current.next();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("goNextUngraded", () => {
    it("navigates to the next ungraded student and returns true", () => {
      const gradedAnswers = [
        makeAnswer("alice", { score: 8 }),
        makeAnswer("bob", { score: null }),
        makeAnswer("charlie", { score: null })
      ];
      setupMocks({ sid: "alice", assignmentId: 1, questionId: 2 });

      const { result } = renderHook(() =>
        useStudentNavigation({ answers: gradedAnswers, question: { autograde: "manual" } })
      );

      let returned: boolean;
      act(() => {
        returned = result.current.goNextUngraded();
      });

      expect(returned!).toBe(true);
      expect(mockNavigate).toHaveBeenCalledWith("/grader/1/questions/2/students/bob");
    });

    it("returns false when no ungraded students and no next question", () => {
      const allGraded = [
        makeAnswer("alice", { score: 8 }),
        makeAnswer("bob", { score: 7 }),
        makeAnswer("charlie", { score: 6 })
      ];
      setupMocks({ sid: "charlie", assignmentId: 1, questionId: 20 });
      const questions = [makeQuestion(20)];

      const { result } = renderHook(() =>
        useStudentNavigation({
          answers: allGraded,
          question: { autograde: "manual" },
          questions
        })
      );

      let returned: boolean;
      act(() => {
        returned = result.current.goNextUngraded();
      });

      expect(returned!).toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("falls back to next student when no ungraded found after current index", () => {
      const mixedAnswers = [
        makeAnswer("alice", { score: null }),
        makeAnswer("bob", { score: 8 }),
        makeAnswer("charlie", { score: 7 })
      ];
      setupMocks({ sid: "alice", assignmentId: 1, questionId: 2 });

      const { result } = renderHook(() =>
        useStudentNavigation({ answers: mixedAnswers, question: { autograde: "manual" } })
      );

      let returned: boolean;
      act(() => {
        returned = result.current.goNextUngraded();
      });

      expect(returned!).toBe(true);
      expect(mockNavigate).toHaveBeenCalledWith("/grader/1/questions/2/students/bob");
    });

    it("falls back to next question when on last student with no ungraded", () => {
      const gradedAnswers = [
        makeAnswer("alice", { score: 8 }),
        makeAnswer("charlie", { score: 7 })
      ];
      const questions = [makeQuestion(10), makeQuestion(20)];
      setupMocks({ sid: "charlie", assignmentId: 1, questionId: 10 });

      const { result } = renderHook(() =>
        useStudentNavigation({
          answers: gradedAnswers,
          question: { autograde: "manual" },
          questions
        })
      );

      let returned: boolean;
      act(() => {
        returned = result.current.goNextUngraded();
      });

      expect(returned!).toBe(true);
      expect(mockNavigate).toHaveBeenCalledWith("/grader/1/questions/20", { state: undefined });
    });

    it("skips dirtySids when looking for ungraded", () => {
      const mixedAnswers = [
        makeAnswer("alice", { score: null }),
        makeAnswer("bob", { score: null }),
        makeAnswer("charlie", { score: null })
      ];
      const dirtySids = new Set(["bob"]);
      setupMocks({ sid: "alice", assignmentId: 1, questionId: 2 });

      const { result } = renderHook(() =>
        useStudentNavigation({
          answers: mixedAnswers,
          question: { autograde: "manual" },
          dirtySids
        })
      );

      act(() => {
        result.current.goNextUngraded();
      });

      expect(mockNavigate).toHaveBeenCalledWith("/grader/1/questions/2/students/bob");
    });
  });

  describe("firstUngraded", () => {
    it("returns the first pending student sid", () => {
      const gradedAnswers = [
        makeAnswer("alice", { score: 8 }),
        makeAnswer("bob", { score: null }),
        makeAnswer("charlie", { score: null })
      ];
      setupMocks({ sid: "alice" });

      const { result } = renderHook(() =>
        useStudentNavigation({ answers: gradedAnswers, question: { autograde: "manual" } })
      );

      expect(result.current.firstUngraded).toBe("bob");
    });

    it("returns undefined when all students are graded", () => {
      const allGraded = [makeAnswer("alice", { score: 9 }), makeAnswer("bob", { score: 7 })];
      setupMocks({ sid: "alice" });

      const { result } = renderHook(() =>
        useStudentNavigation({ answers: allGraded, question: { autograde: "manual" } })
      );

      expect(result.current.firstUngraded).toBeUndefined();
    });

    it("returns undefined when answers array is empty", () => {
      setupMocks({ sid: "alice" });

      const { result } = renderHook(() => useStudentNavigation({ answers: [] }));

      expect(result.current.firstUngraded).toBeUndefined();
    });
  });

  describe("demo mode — activeSid comes from demoSelected", () => {
    it("uses demoSelected.sid for currentIndex in demo mode", () => {
      setupMocks({ isDemo: true, demoSid: "bob" });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.currentIndex).toBe(1);
      expect(result.current.current?.sid).toBe("bob");
    });

    it("returns -1 when demoSelected is null in demo mode", () => {
      vi.mocked(useParams).mockReturnValue({ assignmentId: "1", questionId: "2", sid: "alice" });
      vi.mocked(useNavigate).mockReturnValue(mockNavigate);
      vi.mocked(useGraderTourContext).mockReturnValue({
        isDemo: true,
        demoSelected: null,
        setDemoSelected: mockSetDemoSelected,
        setIsDemo: vi.fn()
      });

      const { result } = renderHook(() => useStudentNavigation({ answers }));

      expect(result.current.currentIndex).toBe(-1);
    });
  });
});
