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
import { useEffect } from "react";
import CodeBlockPrism from "tiptap-extension-code-block-prism";

import "prismjs/plugins/line-numbers/prism-line-numbers.css";

import "tippy.js/dist/tippy.css";
import "katex/dist/katex.min.css";

import styles from "./Editor.module.css";
import { Command, items } from "./SlashCommands";
import { TipTapDocModal, useTipTapDocModal } from "./TipTapDocModal";
import { useTableColumnMenu } from "./hooks/useTableColumnMenu";
import { useTableRowMenu } from "./hooks/useTableRowMenu";
import { TableColumnMenu } from "./components/TableColumnMenu";
import { TableRowMenu } from "./components/TableRowMenu";

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

interface PollEditorProps {
  content: string;
  onChange: (content: string) => void;
  onFocus?: () => void;
  enableBlankOption?: boolean;
}

export const Editor = ({
  content,
  onChange,
  onFocus,
  enableBlankOption = false
}: PollEditorProps) => {
  const { visible, showModal, hideModal } = useTipTapDocModal();

  useEffect(() => {
    const styleElement = document.createElement("style");

    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const getSlashCommandItems = () => {
    if (enableBlankOption) {
      return [
        ...items,
        {
          title: "Add Blank",
          description: "Insert a blank placeholder for fill-in-the-blank exercises",
          icon: "fa-square-plus",
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).insertContent("{blank}").run();
          }
        }
      ];
    }
    return items;
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
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
      CodeBlockPrism.configure({
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
            const commandItems = getSlashCommandItems();

            return commandItems.filter(
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
      TabExtension
    ],
    content,
    onUpdate: ({ editor: uEditor }) => {
      onChange(uEditor.getHTML());
    },
    onFocus: () => {
      onFocus?.();
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

  if (!editor) {
    return null;
  }

  return (
    <div className={styles.editorContainer}>
      <div className={styles.editorHeader}>
        <Button
          icon="pi pi-question-circle"
          text
          size="small"
          onClick={showModal}
          className={styles.helpButton}
          tooltip="Editor Help"
          tooltipOptions={{ position: "left" }}
        />
      </div>

      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 100,
          appendTo: () => document.getElementById("exercise-layout") || document.body
        }}
        className={styles.bubbleMenu}
      >
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? styles.isActive : ""}
        >
          <i className="fa-solid fa-bold" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? styles.isActive : ""}
        >
          <i className="fa-solid fa-italic" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive("strike") ? styles.isActive : ""}
        >
          <i className="fa-solid fa-strikethrough" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={editor.isActive("highlight") ? styles.isActive : ""}
        >
          <i className="fa-solid fa-highlighter" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive("codeBlock") ? styles.isActive : ""}
        >
          <i className="fa-solid fa-code" />
        </button>
        {editor.isActive("table") && (
          <>
            <button onClick={() => editor.chain().focus().addColumnBefore().run()}>
              <i className="fa-solid fa-table-columns" title="Add Column Before" />
            </button>
            <button onClick={() => editor.chain().focus().addColumnAfter().run()}>
              <i className="fa-solid fa-table-columns" title="Add Column After" />
            </button>
            <button onClick={() => editor.chain().focus().deleteColumn().run()}>
              <i className="fa-solid fa-minus" title="Delete Column" />
            </button>
            <button onClick={() => editor.chain().focus().addRowBefore().run()}>
              <i className="fa-solid fa-table-rows" title="Add Row Before" />
            </button>
            <button onClick={() => editor.chain().focus().addRowAfter().run()}>
              <i className="fa-solid fa-table-rows" title="Add Row After" />
            </button>
            <button onClick={() => editor.chain().focus().deleteRow().run()}>
              <i className="fa-solid fa-minus" title="Delete Row" />
            </button>
            <button onClick={() => editor.chain().focus().deleteTable().run()}>
              <i className="fa-solid fa-trash" title="Delete Table" />
            </button>
            <button onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
              <i className="fa-solid fa-heading" title="Toggle Header Row" />
            </button>
          </>
        )}
        {enableBlankOption && (
          <button onClick={() => editor.chain().focus().insertContent("{blank}").run()}>
            <i className="fa-solid fa-square-plus" />
          </button>
        )}
      </BubbleMenu>

      <EditorContent editor={editor} className={styles.editor} />

      <TableColumnMenu
        editor={editor}
        visible={columnMenuVisible}
        position={columnMenuPosition}
        menuRef={columnMenuRef}
        isLastColumn={isLastColumn()}
        onClose={() => setColumnMenuVisible(false)}
      />

      <TableRowMenu
        editor={editor}
        visible={rowMenuVisible}
        position={rowMenuPosition}
        menuRef={rowMenuRef}
        rowElement={currentRowElement}
        isLastRow={isLastRow()}
        onClose={() => setRowMenuVisible(false)}
      />

      <TipTapDocModal visible={visible} onHide={hideModal} />
    </div>
  );
};
