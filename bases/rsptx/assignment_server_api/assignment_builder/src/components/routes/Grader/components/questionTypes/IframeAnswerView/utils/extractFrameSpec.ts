import { FrameSpec } from "../types";

export const extractFrameSpec = (htmlsrc?: string): FrameSpec | null => {
  if (!htmlsrc) return null;
  const doc = new DOMParser().parseFromString(htmlsrc, "text/html");
  const frame = doc.querySelector("iframe");
  const src = frame?.getAttribute("src");

  if (!frame || !src) return null;
  return { src, style: frame.getAttribute("style") ?? "" };
};
