// Custom CodeBlockPrism that preserves marks in HTML serialization
import CodeBlockPrism from "tiptap-extension-code-block-prism";
import { DOMOutputSpec } from "@tiptap/pm/model";

export const CustomCodeBlockPrism = CodeBlockPrism.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: "javascript",
        parseHTML: (element) => element.getAttribute("data-language"),
        renderHTML: (attributes) => ({
          "data-language": attributes.language,
          class: `language-${attributes.language}`
        })
      }
    };
  },

  // Allow all marks inside code blocks
  marks: "_",

  parseHTML() {
    return [
      {
        tag: "pre",
        preserveWhitespace: "full" as const,
        getAttrs: (node) => {
          const element = node as HTMLElement;

          const codeElement = element.querySelector("code");
          if (codeElement) {
            const language = codeElement.getAttribute("data-language") || "javascript";
            return { language };
          }

          const language = element.getAttribute("data-language") || "javascript";
          return { language };
        }
      }
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const language = node.attrs.language || "javascript";

    return [
      "pre",
      {
        ...HTMLAttributes,
        "data-language": language,
        class: HTMLAttributes.class || ""
      },
      0 // This is crucial - it tells TipTap to render all child content including marks
    ] as DOMOutputSpec;
  }
});
