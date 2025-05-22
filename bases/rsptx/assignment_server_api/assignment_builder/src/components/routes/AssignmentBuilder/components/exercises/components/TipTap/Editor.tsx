import { MathExtension } from "@aarkue/tiptap-math-extension";
import { TipTapImage } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Plugins/Image";
import FontFamily from "@tiptap/extension-font-family";
import HardBreak from "@tiptap/extension-hard-break";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Youtube from "@tiptap/extension-youtube";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

import "tippy.js/dist/tippy.css";
import "katex/dist/katex.min.css";

import styles from "./Editor.module.css";
import { Command, items } from "./SlashCommands";

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
  placeholder?: string;
  onFocus?: () => void;
  enableBlankOption?: boolean;
}

export const Editor = ({
  content,
  onChange,
  onFocus,
  placeholder,
  enableBlankOption = false
}: PollEditorProps) => {
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
        codeBlock: {
          HTMLAttributes: {
            class: "bg-gray-100 rounded p-2 font-mono text-sm"
          }
        },
        // Disable hardBreak from StarterKit to avoid conflicts with our custom configuration
        hardBreak: false
      }),
      // Add custom HardBreak extension that uses Enter key for line breaks
      HardBreak.extend({
        addKeyboardShortcuts() {
          return {
            Enter: () => {
              // For lists and other block elements, use default behavior
              if (
                this.editor.isActive("orderedList") ||
                this.editor.isActive("bulletList") ||
                this.editor.isActive("heading") ||
                this.editor.isActive("codeBlock")
              ) {
                return false;
              }
              // Otherwise insert a hard break (line break)
              return this.editor.commands.setHardBreak();
            }
          };
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
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return `Heading ${node.attrs.level}`;
          }
          /* eslint-disable-next-line */
          return placeholder || 'Press "/" for commands...';
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
        delimiters: "dollar",
        katexOptions: {
          throwOnError: false,
          macros: {
            "\\R": "\\mathbb{R}",
            "\\N": "\\mathbb{N}",
            "\\Z": "\\mathbb{Z}"
          }
        }
      })
    ],
    content,
    onUpdate: ({ editor: uEditor }) => {
      onChange(uEditor.getHTML());
    },
    onFocus: () => {
      onFocus?.();
    }
  });

  if (!editor) {
    return null;
  }

  return (
    <div className={styles.editorContainer}>
      <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className={styles.bubbleMenu}>
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
        {enableBlankOption && (
          <button onClick={() => editor.chain().focus().insertContent("{blank}").run()}>
            <i className="fa-solid fa-square-plus" />
          </button>
        )}
      </BubbleMenu>

      <EditorContent editor={editor} className={styles.editor} />
    </div>
  );
};
