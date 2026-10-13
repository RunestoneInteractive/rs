import { useEffect } from "react";

import { detectPlatform } from "./usePlatform";

export interface GraderHotkeyHandlers {
  next?: () => void;

  prev?: () => void;

  nextAttempt?: () => void;

  prevAttempt?: () => void;

  focusGrade?: () => void;

  focusComment?: () => void;

  toggleHideFullCredit?: () => void;

  openHelp?: () => void;
}

interface Options {
  enabled?: boolean;
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "summary",
  "textarea",
  "[contenteditable='true']",
  "[role='button']",
  "[role='checkbox']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='menu']",
  "[role='menuitem']",
  "[role='option']",
  "[role='radio']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='switch']",
  "[role='tab']",
  "[role='textbox']"
].join(",");

const isInteractiveTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;

export const useGraderHotkeys = (
  handlers: GraderHotkeyHandlers,
  { enabled = true }: Options = {}
) => {
  useEffect(() => {
    if (!enabled) return;
    const platform = detectPlatform();
    const isMod = (e: KeyboardEvent) => (platform === "mac" ? e.metaKey : e.ctrlKey);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" && !isMod(e)) {
        if (!isInteractiveTarget(e.target)) {
          e.preventDefault();
          handlers.openHelp?.();
        }
        return;
      }

      if (isInteractiveTarget(e.target) || isMod(e) || e.altKey) return;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          if (handlers.next) {
            e.preventDefault();
            handlers.next();
          }
          break;
        case "k":
        case "ArrowUp":
          if (handlers.prev) {
            e.preventDefault();
            handlers.prev();
          }
          break;
        case "ArrowRight":
          if (handlers.nextAttempt) {
            e.preventDefault();
            handlers.nextAttempt();
          }
          break;
        case "ArrowLeft":
          if (handlers.prevAttempt) {
            e.preventDefault();
            handlers.prevAttempt();
          }
          break;
        case "g":
          handlers.focusGrade?.();
          e.preventDefault();
          break;
        case "c":
          handlers.focusComment?.();
          e.preventDefault();
          break;
        case "h":
          handlers.toggleHideFullCredit?.();
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, handlers]);
};
