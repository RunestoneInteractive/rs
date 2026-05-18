import { driver, Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import {
  DEMO_ANSWERS,
  DEMO_ASSIGNMENT_ID,
  DEMO_QUESTION_ID,
  DEMO_STUDENT_SID
} from "../tour/graderDemoData";
import {
  GRADER_TOUR_STEPS,
  TourRoute,
  TourStepConfig
} from "../tour/graderTourConfig";
import { useGraderTourContext } from "../tour/GraderTourContext";

const TOUR_ROUTES: Record<TourRoute, string> = {
  assignments: "/grader",
  questions: `/grader/${DEMO_ASSIGNMENT_ID}`,

  answers: `/grader/${DEMO_ASSIGNMENT_ID}/questions/${DEMO_QUESTION_ID}`,
  student: `/grader/${DEMO_ASSIGNMENT_ID}/questions/${DEMO_QUESTION_ID}/students/${DEMO_STUDENT_SID}`
};

const waitForElement = (
  selector: string,
  timeout = 4000
): Promise<Element | null> =>
  new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const started = Date.now();
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      } else if (Date.now() - started > timeout) {
        observer.disconnect();
        resolve(null);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeout);
  });

export const useGraderTour = () => {
  const navigate = useNavigate();
  const { setIsDemo, setDemoSelected } = useGraderTourContext();
  const driverRef = useRef<Driver | null>(null);

  const prepareStep = useCallback(
    async (step: TourStepConfig) => {
      const targetPath = TOUR_ROUTES[step.route];
      if (window.location.pathname !== targetPath) {
        navigate(targetPath);
      }
      if (step.openDialog) {
        setDemoSelected(DEMO_ANSWERS.answers[0]);
      } else if (step.route !== "student") {
        setDemoSelected(null);
      }
      await waitForElement(step.element);
    },
    [navigate, setDemoSelected]
  );

  const startTour = useCallback(async () => {

    driverRef.current?.destroy();

    setIsDemo(true);
    setDemoSelected(null);
    navigate("/grader");

    await waitForElement(GRADER_TOUR_STEPS[0].element);

    const cleanup = () => {
      setIsDemo(false);
      setDemoSelected(null);
      navigate("/grader");
    };

    const d = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      smoothScroll: true,
      popoverClass: "grader-tour-popover",
      onDestroyed: cleanup,
      steps: GRADER_TOUR_STEPS.map((step, idx) => ({
        element: step.element,
        popover: {
          title: step.title,
          description: step.description,
          side: step.side,
          align: step.align,
          onNextClick: async (_el, _step, opts) => {
            const next = GRADER_TOUR_STEPS[idx + 1];
            if (next) await prepareStep(next);
            opts.driver.moveNext();
          },
          onPrevClick: async (_el, _step, opts) => {
            const prev = GRADER_TOUR_STEPS[idx - 1];
            if (prev) await prepareStep(prev);
            opts.driver.movePrevious();
          }
        }
      }))
    });

    driverRef.current = d;
    d.drive();
  }, [navigate, prepareStep, setDemoSelected, setIsDemo]);

  useEffect(
    () => () => {

      driverRef.current?.destroy();
      const overlays = document.querySelectorAll(
        ".driver-overlay, .driver-popover"
      );
      overlays.forEach((e) => e.remove());
    },
    []
  );

  return { startTour };
};
