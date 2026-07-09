import { renderHook, act } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";

vi.mock("driver.js", () => {
  const mockDriver = {
    drive: vi.fn(),
    destroy: vi.fn()
  };
  return {
    driver: vi.fn(() => mockDriver),
    Driver: {}
  };
});

vi.mock("driver.js/dist/driver.css", () => ({}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate
}));

const mockSetIsDemo = vi.fn();
const mockSetDemoSelected = vi.fn();
vi.mock("../tour/GraderTourContext", () => ({
  useGraderTourContext: () => ({
    isDemo: false,
    demoSelected: null,
    setIsDemo: mockSetIsDemo,
    setDemoSelected: mockSetDemoSelected
  })
}));

import { driver as driverFactory } from "driver.js";
import { useGraderTour } from "./useGraderTour";
import {
  DEMO_ASSIGNMENT_ID,
  DEMO_QUESTION_ID,
  DEMO_STUDENT_SID,
  DEMO_ANSWERS
} from "../tour/graderDemoData";
import { GRADER_TOUR_STEPS } from "../tour/graderTourConfig";

const TOUR_ROUTES = {
  assignments: "/grader",
  questions: `/grader/${DEMO_ASSIGNMENT_ID}`,
  answers: `/grader/${DEMO_ASSIGNMENT_ID}/questions/${DEMO_QUESTION_ID}`,
  student: `/grader/${DEMO_ASSIGNMENT_ID}/questions/${DEMO_QUESTION_ID}/students/${DEMO_STUDENT_SID}`
};

describe("useGraderTour", () => {
  let mockDriverInstance: { drive: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDriverInstance = { drive: vi.fn(), destroy: vi.fn() };
    (driverFactory as ReturnType<typeof vi.fn>).mockReturnValue(mockDriverInstance);
    mockNavigate.mockClear();
    mockSetIsDemo.mockClear();
    mockSetDemoSelected.mockClear();
    vi.clearAllTimers();
    vi.useFakeTimers();
    const bodyEl = document.createElement("div");
    bodyEl.setAttribute("data-tour", "grader-title");
    bodyEl.className = "grader-title-el";
    document.body.appendChild(bodyEl);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("returns startTour function", () => {
    const { result } = renderHook(() => useGraderTour());
    expect(typeof result.current.startTour).toBe("function");
  });

  it("startTour sets isDemo to true and navigates to /grader", async () => {
    const { result } = renderHook(() => useGraderTour());

    await act(async () => {
      const tourPromise = result.current.startTour();
      vi.runAllTimers();
      await tourPromise;
    });

    expect(mockSetIsDemo).toHaveBeenCalledWith(true);
    expect(mockNavigate).toHaveBeenCalledWith("/grader");
  });

  it("startTour resets demoSelected to null on start", async () => {
    const { result } = renderHook(() => useGraderTour());

    await act(async () => {
      const tourPromise = result.current.startTour();
      vi.runAllTimers();
      await tourPromise;
    });

    expect(mockSetDemoSelected).toHaveBeenCalledWith(null);
  });

  it("startTour calls driver() and drive()", async () => {
    const { result } = renderHook(() => useGraderTour());

    await act(async () => {
      const tourPromise = result.current.startTour();
      vi.runAllTimers();
      await tourPromise;
    });

    expect(driverFactory).toHaveBeenCalled();
    expect(mockDriverInstance.drive).toHaveBeenCalled();
  });

  it("startTour passes correct driver options including showProgress and animate", async () => {
    const { result } = renderHook(() => useGraderTour());

    await act(async () => {
      const tourPromise = result.current.startTour();
      vi.runAllTimers();
      await tourPromise;
    });

    const driverOptions = (driverFactory as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(driverOptions.showProgress).toBe(true);
    expect(driverOptions.animate).toBe(true);
    expect(driverOptions.allowClose).toBe(true);
    expect(driverOptions.smoothScroll).toBe(true);
    expect(driverOptions.popoverClass).toBe("grader-tour-popover");
  });

  it("startTour maps all GRADER_TOUR_STEPS into driver steps", async () => {
    const { result } = renderHook(() => useGraderTour());

    await act(async () => {
      const tourPromise = result.current.startTour();
      vi.runAllTimers();
      await tourPromise;
    });

    const driverOptions = (driverFactory as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(driverOptions.steps).toHaveLength(GRADER_TOUR_STEPS.length);
    expect(driverOptions.steps[0].element).toBe(GRADER_TOUR_STEPS[0].element);
    expect(driverOptions.steps[0].popover.title).toBe(GRADER_TOUR_STEPS[0].title);
    expect(driverOptions.steps[0].popover.description).toBe(GRADER_TOUR_STEPS[0].description);
  });

  it("onDestroyed callback resets isDemo, demoSelected and navigates to /grader", async () => {
    const { result } = renderHook(() => useGraderTour());

    await act(async () => {
      const tourPromise = result.current.startTour();
      vi.runAllTimers();
      await tourPromise;
    });

    mockSetIsDemo.mockClear();
    mockSetDemoSelected.mockClear();
    mockNavigate.mockClear();

    const driverOptions = (driverFactory as ReturnType<typeof vi.fn>).mock.calls[0][0];
    act(() => {
      driverOptions.onDestroyed();
    });

    expect(mockSetIsDemo).toHaveBeenCalledWith(false);
    expect(mockSetDemoSelected).toHaveBeenCalledWith(null);
    expect(mockNavigate).toHaveBeenCalledWith("/grader");
  });

  it("onNextClick calls moveNext on the driver", async () => {
    const { result } = renderHook(() => useGraderTour());

    await act(async () => {
      const tourPromise = result.current.startTour();
      vi.runAllTimers();
      await tourPromise;
    });

    const driverOptions = (driverFactory as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const mockMoveNext = vi.fn();
    const opts = { driver: { moveNext: mockMoveNext, movePrevious: vi.fn() } };

    await act(async () => {
      const nextPromise = driverOptions.steps[0].popover.onNextClick(null, null, opts);
      vi.runAllTimers();
      await nextPromise;
    });

    expect(mockMoveNext).toHaveBeenCalled();
  });

  it("onPrevClick calls movePrevious on the driver", async () => {
    const { result } = renderHook(() => useGraderTour());

    await act(async () => {
      const tourPromise = result.current.startTour();
      vi.runAllTimers();
      await tourPromise;
    });

    const driverOptions = (driverFactory as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const mockMovePrevious = vi.fn();
    const opts = { driver: { moveNext: vi.fn(), movePrevious: mockMovePrevious } };

    await act(async () => {
      const prevPromise = driverOptions.steps[1].popover.onPrevClick(null, null, opts);
      vi.runAllTimers();
      await prevPromise;
    });

    expect(mockMovePrevious).toHaveBeenCalled();
  });

  it("onNextClick navigates to questions route when step transitions to questions route", async () => {
    const { result } = renderHook(() => useGraderTour());

    await act(async () => {
      const tourPromise = result.current.startTour();
      vi.runAllTimers();
      await tourPromise;
    });

    const driverOptions = (driverFactory as ReturnType<typeof vi.fn>).mock.calls[0][0];

    const stepIndexBeforeQuestionsRoute = GRADER_TOUR_STEPS.findIndex(
      (s, i) => i + 1 < GRADER_TOUR_STEPS.length && GRADER_TOUR_STEPS[i + 1].route === "questions"
    );

    const nextQuestionsStepEl = document.createElement("div");
    nextQuestionsStepEl.setAttribute(
      "data-tour",
      GRADER_TOUR_STEPS[stepIndexBeforeQuestionsRoute + 1].element.replace(
        /^\[data-tour="(.+)"\]$/,
        "$1"
      )
    );
    document.body.appendChild(nextQuestionsStepEl);

    mockNavigate.mockClear();

    const opts = { driver: { moveNext: vi.fn(), movePrevious: vi.fn() } };
    await act(async () => {
      const nextPromise = driverOptions.steps[stepIndexBeforeQuestionsRoute].popover.onNextClick(
        null,
        null,
        opts
      );
      vi.runAllTimers();
      await nextPromise;
    });

    expect(mockNavigate).toHaveBeenCalledWith(TOUR_ROUTES.questions);
  });

  it("onNextClick sets demoSelected when next step has openDialog=true", async () => {
    const { result } = renderHook(() => useGraderTour());

    await act(async () => {
      const tourPromise = result.current.startTour();
      vi.runAllTimers();
      await tourPromise;
    });

    const driverOptions = (driverFactory as ReturnType<typeof vi.fn>).mock.calls[0][0];

    const stepBeforeDialog = GRADER_TOUR_STEPS.findIndex(
      (s, i) => i + 1 < GRADER_TOUR_STEPS.length && GRADER_TOUR_STEPS[i + 1].openDialog === true
    );

    mockSetDemoSelected.mockClear();

    const opts = { driver: { moveNext: vi.fn(), movePrevious: vi.fn() } };
    await act(async () => {
      const nextPromise = driverOptions.steps[stepBeforeDialog].popover.onNextClick(
        null,
        null,
        opts
      );
      vi.runAllTimers();
      await nextPromise;
    });

    expect(mockSetDemoSelected).toHaveBeenCalledWith(DEMO_ANSWERS.answers[0]);
  });

  it("startTour destroys existing driver before creating a new one", async () => {
    const { result } = renderHook(() => useGraderTour());

    await act(async () => {
      const firstTour = result.current.startTour();
      vi.runAllTimers();
      await firstTour;
    });

    const firstInstance = mockDriverInstance;

    const secondInstance = { drive: vi.fn(), destroy: vi.fn() };
    (driverFactory as ReturnType<typeof vi.fn>).mockReturnValue(secondInstance);

    await act(async () => {
      const secondTour = result.current.startTour();
      vi.runAllTimers();
      await secondTour;
    });

    expect(firstInstance.destroy).toHaveBeenCalled();
  });

  it("cleanup on unmount destroys driver and removes overlay elements", async () => {
    const overlay = document.createElement("div");
    overlay.className = "driver-overlay";
    document.body.appendChild(overlay);

    const popover = document.createElement("div");
    popover.className = "driver-popover";
    document.body.appendChild(popover);

    const { result, unmount } = renderHook(() => useGraderTour());

    await act(async () => {
      const tourPromise = result.current.startTour();
      vi.runAllTimers();
      await tourPromise;
    });

    act(() => {
      unmount();
    });

    expect(mockDriverInstance.destroy).toHaveBeenCalled();
    expect(document.querySelector(".driver-overlay")).toBeNull();
    expect(document.querySelector(".driver-popover")).toBeNull();
  });

  it("TOUR_ROUTES maps all four route keys to correct paths", () => {
    expect(TOUR_ROUTES.assignments).toBe("/grader");
    expect(TOUR_ROUTES.questions).toBe(`/grader/${DEMO_ASSIGNMENT_ID}`);
    expect(TOUR_ROUTES.answers).toBe(`/grader/${DEMO_ASSIGNMENT_ID}/questions/${DEMO_QUESTION_ID}`);
    expect(TOUR_ROUTES.student).toBe(
      `/grader/${DEMO_ASSIGNMENT_ID}/questions/${DEMO_QUESTION_ID}/students/${DEMO_STUDENT_SID}`
    );
  });
});
