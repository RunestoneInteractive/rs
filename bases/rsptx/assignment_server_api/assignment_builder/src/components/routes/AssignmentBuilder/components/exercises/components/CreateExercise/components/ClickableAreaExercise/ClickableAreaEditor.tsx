import { MathExtension } from "@aarkue/tiptap-math-extension";
import { TipTapImage } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Plugins/Image";
import {
  InsertFormPopover,
  useInsertForm
} from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/components/InsertFormPopover";
import { InsertFormBridge } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/extensions/InsertFormBridge";
import { TabIndent } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/extensions/TabIndent";
import { katexMacros } from "@components/routes/AssignmentBuilder/mathMacros";
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
import { Mark, Node } from "@tiptap/pm/model";
import { Editor, useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ActionIcon, Textarea, Tooltip } from "@mantine/core";
import { FC, useEffect, useState } from "react";

import { Icon } from "@/components/ui/Icon";

import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import "tippy.js/dist/tippy.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "katex/dist/katex.min.css";

import styles from "./ClickableAreaEditor.module.css";
import tipTapStyles from "../../../TipTap/Editor.module.css";
import { Command, items } from "../../../TipTap/SlashCommands";
import { ClickableAreaMark } from "./extensions/ClickableAreaMark";
import { CustomCodeBlockPrism } from "./extensions/CustomCodeBlockPrism";
import { CustomCode } from "./extensions/CustomCode";
import { ClickableArea } from "./types";
import { useTableColumnMenu } from "../../../TipTap/hooks/useTableColumnMenu";
import { useTableRowMenu } from "../../../TipTap/hooks/useTableRowMenu";
import { TableColumnMenu } from "../../../TipTap/components/TableColumnMenu";
import { TableRowMenu } from "../../../TipTap/components/TableRowMenu";

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          return 'Press "/" for commands';
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
        delimiters: "bracket",
        katexOptions: {
          throwOnError: false,
          strict: false,
          trust: true,
          macros: katexMacros
        }
      }),
      TabIndent,
      InsertFormBridge,
      ClickableAreaMark
    ],
    content,
    onUpdate: ({ editor: uEditor }) => {
      const html = uEditor.getHTML();
      onChange(html);
      extractClickableAreas(uEditor);
    }
  });

  const {
    columnMenuVisible,
    columnMenuPosition,
    columnMenuRef,
    setColumnMenuVisible,
    isLastColumn
  } = useTableColumnMenu(editor);

  const {
    rowMenuVisible,
    rowMenuPosition,
    rowMenuRef,
    currentRowElement,
    setRowMenuVisible,
    isLastRow
  } = useTableRowMenu(editor);

  const { insertFormRequest, closeInsertForm } = useInsertForm(editor);

  // Extract clickable areas from the document
  const extractClickableAreas = (ed: Editor) => {
    const areas: ClickableArea[] = [];
    const doc = ed.state.doc;
    const seenIds = new Set<string>();

    doc.descendants((node: Node, pos: number) => {
      // Check if node has marks (text nodes)
      if (node.marks && node.marks.length > 0) {
        node.marks.forEach((mark: Mark) => {
          if (mark.type.name === "clickableAreaMark" && !seenIds.has(mark.attrs.id)) {
            seenIds.add(mark.attrs.id);

            // Extract text content, handling all node types
            const text = node.text || node.textContent || "";

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

  if (!editor) {
    return null;
  }

  return (
    <div>
      <div className={styles.fieldGroup}>
        <Textarea
          id="statement"
          label="Statement"
          value={statement}
          onChange={(e) => onStatementChange?.(e.target.value)}
          placeholder="Enter the question prompt"
          autosize
          minRows={2}
          className={styles.metaInput}
        />
      </div>

      <div className={styles.contentSeparator}>
        <span>Content</span>
      </div>

      <div className={styles.editorContainer}>
        <div className={styles.editorHeader}>
          <Tooltip
            label="Select text and use the bubble menu to mark as correct or incorrect"
            position="left"
            events={{ hover: true, focus: true, touch: true }}
            multiline
            w={240}
          >
            <ActionIcon variant="subtle" className={styles.helpButton} aria-label="Help">
              <Icon name="info-circle" size={16} />
            </ActionIcon>
          </Tooltip>
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
                  <i className="fa-solid fa-trash" aria-hidden="true" />
                  <span>Remove mark</span>
                </button>
              );
            }

            // Otherwise, if text is selected, show correct/incorrect buttons
            if (hasSelection) {
              return (
                <>
                  <button onClick={handleMarkAsCorrect} className="correct">
                    <i className="fa-solid fa-check" aria-hidden="true" />
                    <span>Correct</span>
                  </button>
                  <button onClick={handleMarkAsIncorrect} className="incorrect">
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                    <span>Incorrect</span>
                  </button>
                </>
              );
            }

            return null;
          })()}
        </BubbleMenu>

        <EditorContent editor={editor} className={styles.editor} />

        <InsertFormPopover editor={editor} request={insertFormRequest} onClose={closeInsertForm} />

        <TableColumnMenu
          editor={editor}
          visible={columnMenuVisible}
          position={columnMenuPosition}
          menuRef={columnMenuRef}
          isLastColumn={isLastColumn()}
          onClose={() => setColumnMenuVisible(false)}
          styles={{
            columnMenu: tipTapStyles.columnMenu,
            columnMenuButton: tipTapStyles.columnMenuButton
          }}
        />

        <TableRowMenu
          editor={editor}
          visible={rowMenuVisible}
          position={rowMenuPosition}
          menuRef={rowMenuRef}
          rowElement={currentRowElement}
          isLastRow={isLastRow()}
          onClose={() => setRowMenuVisible(false)}
          styles={{
            rowMenu: tipTapStyles.rowMenu,
            rowMenuButton: tipTapStyles.rowMenuButton,
            rowMenuTooltip: tipTapStyles.rowMenuTooltip
          }}
        />
      </div>

      <div className={styles.fieldGroup}>
        <Textarea
          id="feedback"
          label="Feedback"
          value={feedback}
          onChange={(e) => onFeedbackChange?.(e.target.value)}
          placeholder="Enter feedback for incorrect answers"
          autosize
          minRows={2}
          className={styles.metaInput}
        />
      </div>
    </div>
  );
};
