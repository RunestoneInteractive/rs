import { MathExtension } from "@aarkue/tiptap-math-extension";
import { TipTapImage } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Plugins/Image";
import { katexMacros } from "@components/routes/AssignmentBuilder/mathMacros";
import { Extension } from "@tiptap/core";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Youtube from "@tiptap/extension-youtube";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { FC, useEffect, useState } from "react";

import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import "tippy.js/dist/tippy.css";
import "katex/dist/katex.min.css";

import styles from "./ClickableAreaEditor.module.css";
import { Command, items } from "../../../TipTap/SlashCommands";
import { ClickableAreaMark } from "./extensions/ClickableAreaMark";
import { CustomCodeBlockPrism } from "./extensions/CustomCodeBlockPrism";
import { CustomCode } from "./extensions/CustomCode";
import { ClickableArea } from "./types";

const customStyles = `
  .tippy-box {
    border: none !important;
    background: none !important;
    box-shadow: none !important;
  }
  .tippy-content {
    padding: 0 !important;
  }
  .tippy-arrow {
    display: none !important;
  }
  .katex { font-size: 1.1em; }
`;

const TabExtension = Extension.create({
  name: "tab",
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        return this.editor.commands.insertContent("\t");
      }
    };
  }
});

interface ClickableAreaEditorProps {
  content: string;
  statement: string;
  feedback?: string;
  onChange: (content: string) => void;
  onStatementChange?: (question: string) => void;
  onFeedbackChange?: (feedback: string) => void;
}

export const ClickableAreaEditor: FC<ClickableAreaEditorProps> = ({
  content,
  statement = "",
  feedback = "",
  onChange,
  onStatementChange,
  onFeedbackChange
}) => {
  const [clickableAreas, setClickableAreas] = useState<ClickableArea[]>([]);

  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        code: false, // Disable built-in code mark
        bulletList: {
          HTMLAttributes: {
            class: "list-disc list-outside ml-4"
          }
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal list-outside ml-4"
          }
        },
        listItem: {
          HTMLAttributes: {
            class: "leading-normal"
          }
        },
        blockquote: {
          HTMLAttributes: {
            class: "border-l-4 border-stone-700"
          }
        },
        hardBreak: {
          keepMarks: false
        }
      }),
      CustomCode, // Use custom code mark that allows clickableAreaMark
      CustomCodeBlockPrism.configure({
        defaultLanguage: "javascript",
        HTMLAttributes: {
          class: "line-numbers"
        }
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"]
      }),
      FontFamily.configure({
        types: ["textStyle"]
      }),
      Highlight,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          class: "link"
        }
      }),
      TipTapImage.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: "editor-image"
        }
      }),
      Youtube,
      Table.configure({
        HTMLAttributes: {
          class: "docutils align-default"
        }
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: "row-odd"
        }
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: "head"
        }
      }),
      TableCell,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return `Heading ${node.attrs.level}`;
          }
          return 'Press "/" for commands or select text to mark as correct/incorrect';
        },
        includeChildren: true
      }),
      Command.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            return items.filter(
              (item) =>
                item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.description.toLowerCase().includes(query.toLowerCase())
            );
          }
        }
      }),
      MathExtension.configure({
        delimiters: "dollar",
        katexOptions: {
          throwOnError: false,
          strict: false,
          trust: true,
          macros: katexMacros
        }
      }),
      TabExtension,
      ClickableAreaMark
    ],
    content,
    onUpdate: ({ editor: uEditor }) => {
      const html = uEditor.getHTML();
      onChange(html);
      extractClickableAreas(uEditor);
    }
  });

  // Extract clickable areas from the document
  const extractClickableAreas = (ed: any) => {
    const areas: ClickableArea[] = [];
    const doc = ed.state.doc;
    const seenIds = new Set<string>();

    doc.descendants((node: any, pos: number) => {
      // Check if node has marks (text nodes)
      if (node.marks && node.marks.length > 0) {
        node.marks.forEach((mark: any) => {
          if (mark.type.name === "clickableAreaMark" && !seenIds.has(mark.attrs.id)) {
            seenIds.add(mark.attrs.id);

            // Extract text content, handling all node types
            let text = node.text || node.textContent || "";

            areas.push({
              id: mark.attrs.id,
              type: mark.attrs.type,
              from: pos,
              to: pos + node.nodeSize,
              text: text
            });
          }
        });
      }
    });

    setClickableAreas(areas);
  };

  const handleMarkAsCorrect = () => {
    if (!editor) return;

    editor.chain().focus().setClickableArea("correct").run();

    // Force update
    setTimeout(() => {
      if (editor) {
        extractClickableAreas(editor);
      }
    }, 100);
  };

  const handleMarkAsIncorrect = () => {
    if (!editor) return;

    editor.chain().focus().setClickableArea("incorrect").run();

    // Force update
    setTimeout(() => {
      if (editor) {
        extractClickableAreas(editor);
      }
    }, 100);
  };

  const handleRemoveMark = () => {
    if (!editor) return;

    editor.chain().focus().unsetClickableArea().run();

    // Force update
    setTimeout(() => {
      if (editor) {
        extractClickableAreas(editor);
      }
    }, 100);
  };

  const handleRemoveArea = (areaId: string) => {
    if (!editor) return;

    const { state } = editor;
    const { tr } = state;
    let modified = false;

    state.doc.descendants((node: any, pos: number) => {
      if (node.marks) {
        node.marks.forEach((mark: any) => {
          if (mark.type.name === "clickableAreaMark" && mark.attrs.id === areaId) {
            tr.removeMark(pos, pos + node.nodeSize, mark.type);
            modified = true;
          }
        });
      }
    });

    if (modified) {
      editor.view.dispatch(tr);
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div>
      <div className={styles.contentSeparator}>
        <span>Statement</span>
      </div>

      {/* Statement field */}
      <div className={styles.fieldGroup}>
        <InputTextarea
          id="statement"
          value={statement}
          onChange={(e) => onStatementChange?.(e.target.value)}
          placeholder="Enter the question prompt"
          rows={2}
          className={styles.metaInput}
          autoResize
        />
      </div>

      <div className={styles.contentSeparator}>
        <span>Content</span>
      </div>

      <div className={styles.editorContainer}>
        <div className={styles.editorHeader}>
          <Button
            icon="pi pi-info-circle"
            text
            size="small"
            className={styles.helpButton}
            tooltip="Select text and use the bubble menu to mark as correct or incorrect"
            tooltipOptions={{ position: "left" }}
          />
        </div>

        <BubbleMenu
          editor={editor}
          tippyOptions={{
            duration: 100,
            placement: "top",
            maxWidth: "none"
          }}
          className={styles.clickableBubbleMenu}
          shouldShow={({ editor: ed, state }) => {
            const { selection } = state;
            const { empty } = selection;

            // Always show if there's any text selection, regardless of node type
            if (!empty) {
              return true;
            }

            // Also show if cursor is inside a clickable area mark
            return ed.isActive("clickableAreaMark");
          }}
        >
          {(() => {
            const hasSelection = !editor.state.selection.empty;
            const isInClickableArea = editor.isActive("clickableAreaMark");

            // If cursor/selection is in a clickable area, show remove button
            if (isInClickableArea) {
              return (
                <button onClick={handleRemoveMark} className="remove">
                  <i className="fa-solid fa-trash" />
                  <span>Remove Mark</span>
                </button>
              );
            }

            // Otherwise, if text is selected, show correct/incorrect buttons
            if (hasSelection) {
              return (
                <>
                  <button onClick={handleMarkAsCorrect} className="correct">
                    <i className="fa-solid fa-check" />
                    <span>Correct</span>
                  </button>
                  <button onClick={handleMarkAsIncorrect} className="incorrect">
                    <i className="fa-solid fa-xmark" />
                    <span>Incorrect</span>
                  </button>
                </>
              );
            }

            return null;
          })()}
        </BubbleMenu>

        <EditorContent editor={editor} className={styles.editor} />
      </div>

      <div className={styles.contentSeparator}>
        <span>Feedback</span>
      </div>

      {/* Feedback field */}
      <div className={styles.fieldGroup}>
        <InputTextarea
          id="feedback"
          value={feedback}
          onChange={(e) => onFeedbackChange?.(e.target.value)}
          placeholder="Enter feedback for incorrect answers"
          rows={2}
          className={styles.metaInput}
          autoResize
        />
      </div>
    </div>
  );
};
