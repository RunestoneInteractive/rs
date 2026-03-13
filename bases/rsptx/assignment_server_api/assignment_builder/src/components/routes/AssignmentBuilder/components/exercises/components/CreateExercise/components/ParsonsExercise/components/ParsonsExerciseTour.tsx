import { driver, DriveStep, Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { Button } from "primereact/button";
import React, { FC, useCallback, useEffect, useRef } from "react";

import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { ParsonsMode } from "../ParsonsExercise";

import styles from "./ParsonsExercise.module.css";
import "./ParsonsExerciseTour.css";
import { PARSONS_TOUR_STEPS } from "./parsonsTourConfig";

interface ParsonsFormSnapshot {
  mode: ParsonsMode;
  grader: "line" | "dag";
  orderMode: "random" | "custom";
  numbered: "left" | "right" | "none";
  noindent: boolean;
  adaptive: boolean;
  blocks: ParsonsBlock[];
}

export interface ParsonsExerciseTourProps {
  mode: ParsonsMode;
  formData: {
    blocks?: ParsonsBlock[];
    grader?: "line" | "dag";
    orderMode?: "random" | "custom";
    numbered?: "left" | "right" | "none";
    noindent?: boolean;
    adaptive?: boolean;
  };
  onModeChange: (mode: ParsonsMode) => void;
  updateFormData: (key: string, value: any) => void;
}

const waitForElement = (selector: string, timeout = 1500): Promise<Element | null> =>
  new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const start = Date.now();
    const interval = setInterval(() => {
      const found = document.querySelector(selector);
      if (found || Date.now() - start > timeout) {
        clearInterval(interval);
        resolve(found);
      }
    }, 50);
  });

const nextTick = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

const DEMO_BLOCK: ParsonsBlock = {
  id: "tour-demo-1",
  content: "print('Hello')\nprint('World')",
  indent: 0
};

export const ParsonsExerciseTour: FC<ParsonsExerciseTourProps> = ({
  mode,
  formData,
  onModeChange,
  updateFormData
}) => {
  const driverRef = useRef<Driver | null>(null);
  const snapshotRef = useRef<ParsonsFormSnapshot | null>(null);
  const isTouringRef = useRef(false);

  const takeSnapshot = useCallback(
    (): ParsonsFormSnapshot => ({
      mode,
      grader: formData.grader ?? "line",
      orderMode: formData.orderMode ?? "random",
      numbered: formData.numbered ?? "left",
      noindent: formData.noindent ?? false,
      adaptive: formData.adaptive ?? true,
      blocks: JSON.parse(JSON.stringify(formData.blocks ?? []))
    }),
    [mode, formData]
  );

  const restoreSnapshot = useCallback(() => {
    const snap = snapshotRef.current;
    if (!snap) return;

    onModeChange(snap.mode);
    updateFormData("grader", snap.grader);
    updateFormData("orderMode", snap.orderMode);
    updateFormData("numbered", snap.numbered);
    updateFormData("noindent", snap.noindent);
    updateFormData("adaptive", snap.adaptive);
    updateFormData("blocks", snap.blocks);

    snapshotRef.current = null;
    isTouringRef.current = false;

    document
      .querySelectorAll(".p-overlaypanel, .p-dropdown-panel")
      .forEach((el) => ((el as HTMLElement).style.display = "none"));
  }, [onModeChange, updateFormData]);

  const ensureBlockExists = useCallback(async () => {
    const blocks = formData.blocks ?? [];
    if (blocks.length === 0) {
      updateFormData("blocks", [{ ...DEMO_BLOCK }]);
      await nextTick();
    }
  }, [formData.blocks, updateFormData]);

  const ensureDemoContent = useCallback(async () => {
    const blocks = formData.blocks ?? [];
    if (blocks.length === 0) {
      updateFormData("blocks", [{ ...DEMO_BLOCK }]);
      await nextTick();
    } else {
      const first = blocks[0];
      if (first.content.split("\n").length < 2) {
        const updated = [...blocks];
        updated[0] = { ...first, content: "print('Hello')\nprint('World')" };
        updateFormData("blocks", updated);
        await nextTick();
      }
    }
  }, [formData.blocks, updateFormData]);

  const stepBehaviors: Record<number, () => Promise<void>> = {
    /* 1 — Simple Mode */
    0: async () => {
      if (mode !== "simple") {
        onModeChange("simple");
        await nextTick();
      }
    },
    /* 2 — Enhanced Mode */
    1: async () => {
      onModeChange("enhanced");
      await nextTick();
    },
    /* 3 — Grader */
    2: async () => {
      await nextTick();
    },
    /* 4 — Ordering */
    3: async () => {},
    /* 5 — Line Numbers */
    4: async () => {},
    /* 6 — Toggles */
    5: async () => {},
    /* 7 — No Indent */
    6: async () => {},
    /* 8 — Add Block */
    7: async () => {},
    /* 9 — Delete Block */
    8: async () => {
      await ensureBlockExists();
      await nextTick();
      await waitForElement('[data-tour="first-block"] [aria-label="Remove block"]');
    },
    /* 10 — Drag Handle */
    9: async () => {
      await ensureBlockExists();
      await nextTick();
      await waitForElement('[data-tour="drag-handle"]');
    },
    /* 11 — Split Block */
    10: async () => {
      await ensureDemoContent();
      await nextTick();
      await waitForElement('[data-tour="first-block"]');
    },
    /* 12 — Solution & Distractor */
    11: async () => {
      await ensureBlockExists();
      await nextTick();
      await waitForElement('[data-tour="distractor-pill"]');
    },
    /* 13 — Block Options */
    12: async () => {
      await ensureBlockExists();
      await nextTick();
      await waitForElement('[data-tour="first-block"] [aria-label="Block options"]');
    },
    /* 14 — Fullscreen */
    13: async () => {
      await nextTick();
      await waitForElement('[data-tour="fullscreen-btn"]');
    }
  };

  const buildSteps = useCallback((): DriveStep[] => {
    return PARSONS_TOUR_STEPS.map((cfg, idx) => ({
      element: cfg.element,
      popover: {
        title: cfg.title,
        description: cfg.description,
        side: cfg.side,
        align: cfg.align
      },
      ...(stepBehaviors[idx] && { onHighlightStarted: stepBehaviors[idx] })
    }));
  }, [mode, formData, onModeChange, updateFormData, ensureBlockExists, ensureDemoContent]);

  const startTour = useCallback(() => {
    snapshotRef.current = takeSnapshot();
    isTouringRef.current = true;

    const steps = buildSteps();

    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: "rgba(0, 0, 0, 0.55)",
      stagePadding: 8,
      stageRadius: 10,
      allowClose: true,
      popoverClass: "parsons-tour-popover",
      onDestroyed: () => {
        restoreSnapshot();
        driverRef.current = null;
      },
      steps
    });

    driverRef.current = driverObj;
    driverObj.drive();
  }, [takeSnapshot, buildSteps, restoreSnapshot]);

  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
      if (isTouringRef.current) {
        restoreSnapshot();
      }
    };
  }, [restoreSnapshot]);

  return (
    <Button
      label="Tour"
      icon="pi pi-question-circle"
      className={styles.addBlockButton}
      size="small"
      severity="help"
      outlined
      onClick={startTour}
      data-tour="tour-trigger-btn"
    />
  );
};
