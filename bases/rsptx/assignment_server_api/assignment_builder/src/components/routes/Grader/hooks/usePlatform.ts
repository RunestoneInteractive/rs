import { useMemo } from "react";

export type Platform = "mac" | "other";

export const detectPlatform = (): Platform => {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const platform =
    // @ts-expect-error - userAgentData not in lib.dom yet
    navigator.userAgentData?.platform || navigator.platform || "";
  if (/Mac|iPhone|iPad|iPod/i.test(`${platform} ${ua}`)) return "mac";
  return "other";
};

export const usePlatform = (): Platform => useMemo(detectPlatform, []);

export const modKeyLabel = (p: Platform) => (p === "mac" ? "⌘" : "Ctrl");
export const altKeyLabel = (p: Platform) => (p === "mac" ? "⌥" : "Alt");
export const shiftKeyLabel = "⇧";
