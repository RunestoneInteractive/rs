import { useEffect } from "react";

import { detectPlatform } from "./usePlatform";

export interface GraderHotkeyHandlers {

  next?: () => void;

  prev?: () => void;

  nextAttempt?: () => void;

  prevAttempt?: () => void;

  focusGrade?: () => void;

  focusComment?: () => void;

  toggleHideGraded?: () => void;

  openHelp?: () => void;
}

interface Options {
  enabled?: boolean;
}

const isInputTarget = (t: EventTarget | null): boolean => {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return t.isContentEditable;
};

export const useGraderHotkeys = (
  handlers: GraderHotkeyHandlers,
  { enabled = true }: Options = {}
) => {
  useEffect(() => {
    if (!enabled) return;
    const platform = detectPlatform();
    const isMod = (e: KeyboardEvent) =>
      platform === "mac" ? e.metaKey : e.ctrlKey;

    const onKeyDown = (e: KeyboardEvent) => {

      if (e.key === "?" && !isMod(e)) {
        if (!isInputTarget(e.target)) {
          e.preventDefault();
          handlers.openHelp?.();
        }
        return;
      }

      if (isInputTarget(e.target) || isMod(e) || e.altKey) return;

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
          handlers.toggleHideGraded?.();
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, handlers]);
};
