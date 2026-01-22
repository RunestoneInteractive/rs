import Code from "@tiptap/extension-code";

export const CustomCode = Code.extend({
  // Don't exclude clickableAreaMark - allow it to coexist with code
  // We still exclude formatting marks that don't make sense inside code
  excludes: "link bold italic strike underline highlight",

  // Marks should not span across code boundaries
  spanning: false
});
