import { Mark, mergeAttributes } from "@tiptap/core";

export interface ClickableAreaHighlightOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    clickableAreaHighlight: {
      setClickableAreaHighlight: (attributes?: {
        isCorrect: boolean;
        areaId: string;
      }) => ReturnType;
      toggleClickableAreaHighlight: (attributes?: {
        isCorrect: boolean;
        areaId: string;
      }) => ReturnType;
      unsetClickableAreaHighlight: () => ReturnType;
    };
  }
}

export const ClickableAreaHighlight = Mark.create<ClickableAreaHighlightOptions>({
  name: "clickableAreaHighlight",

  addOptions() {
    return {
      HTMLAttributes: {}
    };
  },

  addAttributes() {
    return {
      isCorrect: {
        default: true,
        parseHTML: (element) => {
          const value = element.getAttribute("data-is-correct");
          return value === "true";
        },
        renderHTML: (attributes) => {
          return {
            "data-is-correct": String(attributes.isCorrect)
          };
        }
      },
      areaId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-area-id"),
        renderHTML: (attributes) => {
          if (!attributes.areaId) {
            return {};
          }
          return {
            "data-area-id": attributes.areaId
          };
        }
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-clickable-area]"
      }
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const isCorrect = mark.attrs.isCorrect;
    const className = isCorrect ? "clickable-correct" : "clickable-incorrect";

    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-clickable-area": "",
        "data-is-correct": String(isCorrect),
        class: className
      }),
      0
    ];
  },

  addCommands() {
    return {
      setClickableAreaHighlight:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      toggleClickableAreaHighlight:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
      unsetClickableAreaHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        }
    };
  }
});
