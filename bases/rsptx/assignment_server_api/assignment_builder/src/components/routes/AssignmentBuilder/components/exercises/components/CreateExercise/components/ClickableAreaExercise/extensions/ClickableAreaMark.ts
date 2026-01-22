// TipTap extension for marking clickable areas
import { Mark, mergeAttributes } from "@tiptap/core";

export interface ClickableAreaMarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    clickableAreaMark: {
      setClickableArea: (type: "correct" | "incorrect") => ReturnType;
      unsetClickableArea: () => ReturnType;
    };
  }
}

export const ClickableAreaMark = Mark.create<ClickableAreaMarkOptions>({
  name: "clickableAreaMark",

  addOptions() {
    return {
      HTMLAttributes: {}
    };
  },

  // Allow this mark to be applied everywhere, including code blocks
  excludes: "",

  // This mark can coexist with other marks
  spanning: true,

  // Enable exiting behavior - allows users to exit the mark
  exiting: true,

  addAttributes() {
    return {
      type: {
        default: null,
        parseHTML: (element) => {
          // Parse from both old and new format
          if (element.hasAttribute("data-correct")) return "correct";
          if (element.hasAttribute("data-incorrect")) return "incorrect";
          return element.getAttribute("data-clickable-type");
        },
        renderHTML: (attributes) => {
          if (!attributes.type) {
            return {};
          }

          // Render directly as data-correct="" or data-incorrect=""
          return {
            [`data-${attributes.type}`]: "",
            class: `clickable-area clickable-area-${attributes.type} clickable`
          };
        }
      },
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-clickable-id"),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }

          return {
            "data-clickable-id": attributes.id
          };
        }
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-clickable-type]"
      },
      {
        tag: "span[data-correct]"
      },
      {
        tag: "span[data-incorrect]"
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setClickableArea:
        (type: "correct" | "incorrect") =>
        ({ chain, state }) => {
          const id = `clickable-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { from, to } = state.selection;

          // Find all marks that overlap with the selection
          const marksToRemove: Array<{ from: number; to: number }> = [];

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.isText) {
              const marks = node.marks.filter((mark) => mark.type.name === this.name);
              if (marks.length > 0) {
                // Calculate the full range of this text node with the mark
                const nodeFrom = pos;
                const nodeTo = pos + node.nodeSize;
                marksToRemove.push({ from: nodeFrom, to: nodeTo });
              }
            }
          });

          // Also check if selection starts or ends within a mark
          const $from = state.doc.resolve(from);
          const $to = state.doc.resolve(to);

          const marksAtFrom = $from.marks().filter((mark) => mark.type.name === this.name);
          const marksAtTo = $to.marks().filter((mark) => mark.type.name === this.name);

          // If we're at the edge of a mark, we need to find its full range
          if (marksAtFrom.length > 0 || marksAtTo.length > 0) {
            // Expand search to find the full mark range
            let searchFrom = Math.max(0, from - 500);
            let searchTo = Math.min(state.doc.content.size, to + 500);

            state.doc.nodesBetween(searchFrom, searchTo, (node, pos) => {
              if (node.isText) {
                const marks = node.marks.filter((mark) => mark.type.name === this.name);
                if (marks.length > 0) {
                  const nodeFrom = pos;
                  const nodeTo = pos + node.nodeSize;

                  // Check if this mark overlaps with our selection
                  if (nodeFrom < to && nodeTo > from) {
                    // Avoid duplicates
                    if (
                      !marksToRemove.some((range) => range.from === nodeFrom && range.to === nodeTo)
                    ) {
                      marksToRemove.push({ from: nodeFrom, to: nodeTo });
                    }
                  }
                }
              }
            });
          }

          // Remove all overlapping marks, then apply the new mark
          let chainCommand = chain();

          marksToRemove.forEach(({ from: markFrom, to: markTo }) => {
            chainCommand = chainCommand
              .setTextSelection({ from: markFrom, to: markTo })
              .unsetMark(this.name);
          });

          // Restore original selection and apply new mark
          chainCommand = chainCommand
            .setTextSelection({ from, to })
            .setMark(this.name, { type, id })
            .setMeta("addToHistory", true);

          // If the mark is at the end of the document, add a space after it
          // to allow users to exit the mark
          if (to >= state.doc.content.size - 1) {
            chainCommand = chainCommand.insertContentAt(to + 1, " ", {
              updateSelection: false
            });
          }

          return chainCommand.run();
        },
      unsetClickableArea:
        () =>
        ({ commands, state, chain }) => {
          const { from, empty } = state.selection;

          // If there's a selection, just unset the mark
          if (!empty) {
            return commands.unsetMark(this.name);
          }

          // If cursor is in a mark but no selection, find and remove the entire mark
          const $pos = state.doc.resolve(from);
          const marks = $pos.marks();

          const clickableMark = marks.find((mark) => mark.type.name === this.name);

          if (!clickableMark) {
            console.log("No clickable mark found at cursor position");
            return false;
          }

          const markId = clickableMark.attrs.id;

          // Collect all text nodes with this mark ID
          const markedRanges: Array<{ from: number; to: number }> = [];

          state.doc.descendants((node, pos) => {
            if (node.isText && node.marks) {
              const hasMark = node.marks.some(
                (m) => m.type.name === this.name && m.attrs.id === markId
              );

              if (hasMark) {
                markedRanges.push({
                  from: pos,
                  to: pos + node.nodeSize
                });
              }
            }
          });

          // Find the continuous range that contains the cursor position
          let markFrom: number | null = null;
          let markTo: number | null = null;

          // Sort ranges by position
          markedRanges.sort((a, b) => a.from - b.from);

          // Find the range containing cursor and merge adjacent ranges
          for (let i = 0; i < markedRanges.length; i++) {
            const range = markedRanges[i];

            // Check if this range contains the cursor
            if (from >= range.from && from <= range.to) {
              markFrom = range.from;
              markTo = range.to;

              // Extend backwards to merge adjacent ranges
              for (let j = i - 1; j >= 0; j--) {
                if (markedRanges[j].to === markFrom) {
                  markFrom = markedRanges[j].from;
                } else {
                  break;
                }
              }

              // Extend forwards to merge adjacent ranges
              for (let j = i + 1; j < markedRanges.length; j++) {
                if (markedRanges[j].from === markTo) {
                  markTo = markedRanges[j].to;
                } else {
                  break;
                }
              }

              break;
            }
          }

          if (markFrom === null || markTo === null) {
            return false;
          }

          // Select the entire mark range and remove it
          const result = chain()
            .setTextSelection({ from: markFrom, to: markTo })
            .unsetMark(this.name)
            .run();

          return result;
        }
    };
  },

  // Allow code marks to coexist
  code: false
});
