import { MathExtension } from "@aarkue/tiptap-math-extension";
import { TipTapImage } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Plugins/Image";
import { katexMacros } from "@components/routes/AssignmentBuilder/mathMacros";
import { Editor as TipTapEditor, Range } from "@tiptap/core";
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
import { Icon } from "@components/ui/Icon";
import { ActionIcon, Tooltip } from "@mantine/core";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import CodeBlockPrism from "tiptap-extension-code-block-prism";

import "prismjs/plugins/line-numbers/prism-line-numbers.css";

import "tippy.js/dist/tippy.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "katex/dist/katex.min.css";

import styles from "./Editor.module.css";
import { Command, items } from "./SlashCommands";
import { TipTapDocModal, useTipTapDocModal } from "./TipTapDocModal";
import { useTableColumnMenu } from "./hooks/useTableColumnMenu";
import { useTableRowMenu } from "./hooks/useTableRowMenu";
import { TableColumnMenu } from "./components/TableColumnMenu";
import { TableRowMenu } from "./components/TableRowMenu";
import { InsertFormPopover, useInsertForm } from "./components/InsertFormPopover";
import { InsertFormBridge } from "./extensions/InsertFormBridge";
import { TabIndent } from "./extensions/TabIndent";

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

interface PollEditorProps {
  content: string;
  onChange: (content: string) => void;
  onFocus?: () => void;
  enableBlankOption?: boolean;
}

interface BubbleMenuButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
  pressed?: boolean;
}

const BubbleMenuButton = ({ label, icon, onClick, pressed }: BubbleMenuButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={pressed ? styles.isActive : ""}
    aria-label={label}
    aria-pressed={pressed}
    title={label}
  >
    <i className={`fa-solid ${icon}`} aria-hidden="true" />
  </button>
);

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
          title: "Add blank",
          description: "Insert a blank placeholder for fill-in-the-blank exercises",
          icon: "fa-square-plus",
          command: ({ editor, range }: { editor: TipTapEditor; range: Range }) => {
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
      TabIndent,
      InsertFormBridge
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

  const { insertFormRequest, closeInsertForm } = useInsertForm(editor);

  if (!editor) {
    return null;
  }

  return (
    <div className={styles.editorContainer}>
      <div className={styles.editorHeader}>
        <Tooltip
          label="Editor help"
          position="left"
          events={{ hover: true, focus: true, touch: true }}
        >
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={showModal}
            className={styles.helpButton}
            aria-label="Editor help"
          >
            <Icon name="question-circle" />
          </ActionIcon>
        </Tooltip>
      </div>

      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 100,
          appendTo: () => document.getElementById("exercise-layout") || document.body
        }}
        className={styles.bubbleMenu}
      >
        <BubbleMenuButton
          label="Bold"
          icon="fa-bold"
          pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <BubbleMenuButton
          label="Italic"
          icon="fa-italic"
          pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <BubbleMenuButton
          label="Strikethrough"
          icon="fa-strikethrough"
          pressed={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <BubbleMenuButton
          label="Highlight"
          icon="fa-highlighter"
          pressed={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        />
        <BubbleMenuButton
          label="Code block"
          icon="fa-code"
          pressed={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        {editor.isActive("table") && (
          <>
            <BubbleMenuButton
              label="Add column left"
              icon="fa-table-columns"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
            />
            <BubbleMenuButton
              label="Add column right"
              icon="fa-table-columns"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            />
            <BubbleMenuButton
              label="Delete column"
              icon="fa-minus"
              onClick={() => editor.chain().focus().deleteColumn().run()}
            />
            <BubbleMenuButton
              label="Add row above"
              icon="fa-table-rows"
              onClick={() => editor.chain().focus().addRowBefore().run()}
            />
            <BubbleMenuButton
              label="Add row below"
              icon="fa-table-rows"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            />
            <BubbleMenuButton
              label="Delete row"
              icon="fa-minus"
              onClick={() => editor.chain().focus().deleteRow().run()}
            />
            <BubbleMenuButton
              label="Delete table"
              icon="fa-trash"
              onClick={() => editor.chain().focus().deleteTable().run()}
            />
            <BubbleMenuButton
              label="Toggle header row"
              icon="fa-heading"
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            />
          </>
        )}
        {enableBlankOption && (
          <BubbleMenuButton
            label="Add blank"
            icon="fa-square-plus"
            onClick={() => editor.chain().focus().insertContent("{blank}").run()}
          />
        )}
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
