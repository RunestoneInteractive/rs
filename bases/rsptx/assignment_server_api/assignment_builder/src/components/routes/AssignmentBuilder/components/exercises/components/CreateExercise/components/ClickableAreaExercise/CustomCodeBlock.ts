import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Custom CodeBlock that supports marks (including highlights)
export const CustomCodeBlock = Node.create({
  name: "customCodeBlock",

  addOptions() {
    return {
      languageClassPrefix: "language-",
      exitOnTripleEnter: true,
      exitOnArrowDown: true,
      HTMLAttributes: {}
    };
  },

  content: "text*",

  marks: "highlight", // This is key - allow highlight marks

  group: "block",

  code: true,

  defining: true,

  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: (element) => {
          const { languageClassPrefix } = this.options;
          const classNames = [...(element.firstElementChild?.classList || [])];
          const languages = classNames
            .filter((className) => className.startsWith(languageClassPrefix))
            .map((className) => className.replace(languageClassPrefix, ""));
          const language = languages[0];

          if (!language) {
            return null;
          }

          return language;
        },
        rendered: false
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: "pre",
        preserveWhitespace: "full"
      }
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "line-numbers"
      }),
      [
        "code",
        {
          class: node.attrs.language ? this.options.languageClassPrefix + node.attrs.language : null
        },
        0
      ]
    ];
  },

  addCommands() {
    return {
      setCodeBlock:
        (attributes) =>
        ({ commands }) => {
          return commands.setNode(this.name, attributes);
        },
      toggleCodeBlock:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleNode(this.name, "paragraph", attributes);
        }
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-c": () => this.editor.commands.toggleCodeBlock(),

      // remove code block when at start of document or code block is empty
      Backspace: () => {
        const { empty, $anchor } = this.editor.state.selection;
        const isAtStart = $anchor.pos === 1;

        if (!empty || $anchor.parent.type.name !== this.name) {
          return false;
        }

        if (isAtStart || !$anchor.parent.textContent.length) {
          return this.editor.commands.clearNodes();
        }

        return false;
      },

      // exit node on triple enter
      Enter: ({ editor }) => {
        if (!this.options.exitOnTripleEnter) {
          return false;
        }

        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if (!empty || $from.parent.type !== this.type) {
          return false;
        }

        const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2;
        const endsWithDoubleNewline = $from.parent.textContent.endsWith("\n\n");

        if (!isAtEnd || !endsWithDoubleNewline) {
          return false;
        }

        return editor
          .chain()
          .command(({ tr }) => {
            tr.delete($from.pos - 2, $from.pos);

            return true;
          })
          .exitCode()
          .run();
      },

      // exit node on arrow down
      ArrowDown: ({ editor }) => {
        if (!this.options.exitOnArrowDown) {
          return false;
        }

        const { state } = editor;
        const { selection, doc } = state;
        const { $from, empty } = selection;

        if (!empty || $from.parent.type !== this.type) {
          return false;
        }

        const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2;

        if (!isAtEnd) {
          return false;
        }

        const after = $from.after();

        if (after === undefined) {
          return false;
        }

        const nodeAfter = doc.nodeAt(after);

        if (nodeAfter) {
          return false;
        }

        return editor.commands.exitCode();
      }
    };
  },

  addInputRules() {
    return [
      {
        find: /^```([a-z]*)?[\s\n]$/,
        handler: ({ state, range, match }) => {
          const attributes: { language?: string } = {};

          if (match[1]) {
            attributes.language = match[1];
          }

          const { tr } = state;
          const start = range.from;
          const end = range.to;

          tr.replaceWith(start, end, this.type.create(attributes));
        }
      }
    ];
  },

  addProseMirrorPlugins() {
    return [
      // Plugin for syntax highlighting using Prism
      new Plugin({
        key: new PluginKey("codeBlockHighlighting"),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            const { doc } = state;

            doc.descendants((node, pos) => {
              if (node.type.name !== this.name) {
                return;
              }

              const language = node.attrs.language;
              if (language && typeof window !== "undefined" && window.Prism) {
                try {
                  const grammar = window.Prism.languages[language];
                  if (grammar) {
                    const tokens = window.Prism.tokenize(node.textContent, grammar);
                    let offset = 0;

                    const processTokens = (tokens: any[], parentOffset: number = 0) => {
                      tokens.forEach((token) => {
                        if (typeof token === "string") {
                          offset += token.length;
                        } else if (token.content) {
                          if (Array.isArray(token.content)) {
                            processTokens(token.content, offset);
                          } else {
                            offset += token.content.length;
                          }
                        }
                      });
                    };

                    processTokens(tokens);
                  }
                } catch (error) {
                  console.warn("Prism highlighting error:", error);
                }
              }
            });

            return DecorationSet.create(doc, decorations);
          }
        }
      })
    ];
  }
});

declare global {
  interface Window {
    Prism: any;
  }
}
