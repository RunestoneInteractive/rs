import { TipTapImageAttributes } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Plugins/Image";
import { Editor, Extension, Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import React, { useCallback, useState, useImperativeHandle } from "react";
import tippy from "tippy.js";

import styles from "./SlashCommands.module.css";

interface CommandItem {
  title: string;
  description: string;
  icon: string;
  command?: ({ editor, range }: { editor: Editor; range: Range }) => void;
  submenu?: CommandItem[];
}

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
  editor: Editor;
  range: Range;
}

const CommandList = React.forwardRef<any, CommandListProps>(
  ({ items, command, editor, range }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showSubmenu, setShowSubmenu] = useState<number | null>(null);
    const [submenuSelectedIndex, setSubmenuSelectedIndex] = useState(0);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];

        if (item) {
          if (item.submenu) {
            setShowSubmenu(index);
            setSubmenuSelectedIndex(0);
          } else if (item.command) {
            command(item);
          }
        }
      },
      [items, command]
    );

    const selectSubmenuItem = useCallback(
      (index: number) => {
        const parentItem = items[showSubmenu!];
        const submenuItem = parentItem?.submenu?.[index];

        if (submenuItem && submenuItem.command) {
          command(submenuItem);
        }
      },
      [items, showSubmenu, command]
    );

    const onKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (showSubmenu !== null) {
          // Submenu navigation
          const submenuItems = items[showSubmenu]?.submenu || [];

          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSubmenuSelectedIndex(
              (prev) => (prev + submenuItems.length - 1) % submenuItems.length
            );
            return true;
          }

          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSubmenuSelectedIndex((prev) => (prev + 1) % submenuItems.length);
            return true;
          }

          if (e.key === "Enter") {
            e.preventDefault();
            selectSubmenuItem(submenuSelectedIndex);
            return true;
          }

          if (e.key === "Escape" || e.key === "ArrowLeft") {
            e.preventDefault();
            setShowSubmenu(null);
            return true;
          }
        } else {
          // Main menu navigation
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
            return true;
          }

          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % items.length);
            return true;
          }

          if (e.key === "Enter") {
            e.preventDefault();
            selectItem(selectedIndex);
            return true;
          }

          if (e.key === "ArrowRight") {
            e.preventDefault();
            const item = items[selectedIndex];

            if (item?.submenu) {
              setShowSubmenu(selectedIndex);
              setSubmenuSelectedIndex(0);
            }
            return true;
          }
        }

        return false;
      },
      [items, selectedIndex, showSubmenu, submenuSelectedIndex, selectItem, selectSubmenuItem]
    );

    // Expose functions for external use
    useImperativeHandle(ref, () => ({
      selectItem: showSubmenu !== null ? selectSubmenuItem : selectItem,
      selectedIndex: showSubmenu !== null ? submenuSelectedIndex : selectedIndex,
      onKeyDown: onKeyDown
    }));

    return (
      <div className={styles.commandList} onKeyDown={onKeyDown}>
        {items.map((item: any, index: number) => (
          <div key={index} className={styles.commandItemWrapper}>
            <button
              className={styles.commandItem}
              onClick={() => selectItem(index)}
              onMouseEnter={() => {
                setSelectedIndex(index);
                if (item.submenu) {
                  setShowSubmenu(index);
                  setSubmenuSelectedIndex(0);
                } else {
                  setShowSubmenu(null);
                }
              }}
              data-selected={index === selectedIndex}
            >
              <i className={`fa-solid ${item.icon}`} />
              <div>
                <div className={styles.commandTitle}>{item.title}</div>
                <div className={styles.commandDescription}>{item.description}</div>
              </div>
              {item.submenu && (
                <i
                  className="fa-solid fa-chevron-right"
                  style={{ marginLeft: "auto", opacity: 0.5 }}
                />
              )}
            </button>

            {showSubmenu === index && item.submenu && (
              <div className={styles.submenu}>
                {item.submenu.map((submenuItem: any, submenuIndex: number) => (
                  <button
                    key={submenuIndex}
                    className={styles.submenuItem}
                    onClick={() => selectSubmenuItem(submenuIndex)}
                    onMouseEnter={() => setSubmenuSelectedIndex(submenuIndex)}
                    data-selected={submenuIndex === submenuSelectedIndex}
                  >
                    <i className={`fa-solid ${submenuItem.icon}`} />
                    <div>
                      <div className={styles.commandTitle}>{submenuItem.title}</div>
                      <div className={styles.commandDescription}>{submenuItem.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
);

// Simplified to 5 main categories with submenus
export const items: CommandItem[] = [
  {
    title: "Text Formatting",
    description: "Format text with bold, italic, etc.",
    icon: "fa-font",
    submenu: [
      {
        title: "Bold Text",
        description: "Make text bold",
        icon: "fa-bold",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBold().run();
        }
      },
      {
        title: "Italic Text",
        description: "Make text italic",
        icon: "fa-italic",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleItalic().run();
        }
      },
      {
        title: "Underline",
        description: "Underline text",
        icon: "fa-underline",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleUnderline().run();
        }
      },
      {
        title: "Highlight",
        description: "Highlight text",
        icon: "fa-highlighter",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleHighlight().run();
        }
      },
      {
        title: "Strikethrough",
        description: "Strike through text",
        icon: "fa-strikethrough",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleStrike().run();
        }
      },
      {
        title: "Clear Formatting",
        description: "Remove all text formatting",
        icon: "fa-eraser",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).clearNodes().unsetAllMarks().run();
        }
      }
    ]
  },
  {
    title: "Headings",
    description: "Create different sized headings",
    icon: "fa-heading",
    submenu: [
      {
        title: "Heading 1",
        description: "Large heading",
        icon: "fa-heading",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
        }
      },
      {
        title: "Heading 2",
        description: "Medium heading",
        icon: "fa-heading",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
        }
      },
      {
        title: "Heading 3",
        description: "Small heading",
        icon: "fa-heading",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
        }
      },
      {
        title: "Heading 4",
        description: "Extra small heading",
        icon: "fa-heading",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 4 }).run();
        }
      }
    ]
  },
  {
    title: "Lists & Structure",
    description: "Create lists and structure content",
    icon: "fa-list",
    submenu: [
      {
        title: "Bullet List",
        description: "Create a bullet list",
        icon: "fa-list-ul",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        }
      },
      {
        title: "Numbered List",
        description: "Create a numbered list",
        icon: "fa-list-ol",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        }
      },
      {
        title: "Quote",
        description: "Add a blockquote",
        icon: "fa-quote-left",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        }
      },
      {
        title: "Horizontal Rule",
        description: "Add a horizontal line",
        icon: "fa-minus",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        }
      }
    ]
  },
  {
    title: "Code & Math",
    description: "Insert code blocks and math expressions",
    icon: "fa-code",
    submenu: [
      {
        title: "Code Block",
        description: "Insert a code block",
        icon: "fa-code",
        command: ({ editor, range }) => {
          const language = prompt(
            "Enter programming language (e.g., python, javascript, java) or leave empty for default:"
          );

          if (language !== null) {
            // User didn't cancel
            const trimmedLanguage = language.trim();

            if (trimmedLanguage) {
              editor
                .chain()
                .focus()
                .deleteRange(range)
                .setCodeBlock({ language: trimmedLanguage })
                .run();
            } else {
              editor.chain().focus().deleteRange(range).setCodeBlock().run();
            }
          }
        }
      },
      {
        title: "Inline Code",
        description: "Insert inline code",
        icon: "fa-terminal",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCode().run();
        }
      },
      {
        title: "Math Expression",
        description: "Add mathematical formulas (LaTeX)",
        icon: "fa-square-root-variable",
        command: ({ editor, range }) => {
          const formula = prompt("Enter LaTeX formula:");

          if (formula) {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent({ type: "inlineMath", attrs: { latex: formula } })
              .run();
          }
        }
      }
    ]
  },
  {
    title: "Tables",
    description: "Insert and manage tables",
    icon: "fa-table",
    submenu: [
      {
        title: "Insert Table",
        description: "Create a new table (3x3)",
        icon: "fa-table",
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
        }
      },
      {
        title: "Add Column Before",
        description: "Add a column before current",
        icon: "fa-table-columns",
        command: ({ editor }) => {
          editor.chain().focus().addColumnBefore().run();
        }
      },
      {
        title: "Add Column After",
        description: "Add a column after current",
        icon: "fa-table-columns",
        command: ({ editor }) => {
          editor.chain().focus().addColumnAfter().run();
        }
      },
      {
        title: "Delete Column",
        description: "Remove current column",
        icon: "fa-table-columns",
        command: ({ editor }) => {
          editor.chain().focus().deleteColumn().run();
        }
      },
      {
        title: "Add Row Before",
        description: "Add a row before current",
        icon: "fa-table-rows",
        command: ({ editor }) => {
          editor.chain().focus().addRowBefore().run();
        }
      },
      {
        title: "Add Row After",
        description: "Add a row after current",
        icon: "fa-table-rows",
        command: ({ editor }) => {
          editor.chain().focus().addRowAfter().run();
        }
      },
      {
        title: "Delete Row",
        description: "Remove current row",
        icon: "fa-table-rows",
        command: ({ editor }) => {
          editor.chain().focus().deleteRow().run();
        }
      },
      {
        title: "Toggle Header Row",
        description: "Toggle header for first row",
        icon: "fa-heading",
        command: ({ editor }) => {
          editor.chain().focus().toggleHeaderRow().run();
        }
      },
      {
        title: "Merge Cells",
        description: "Merge selected cells",
        icon: "fa-object-group",
        command: ({ editor }) => {
          editor.chain().focus().mergeCells().run();
        }
      },
      {
        title: "Split Cell",
        description: "Split merged cell",
        icon: "fa-object-ungroup",
        command: ({ editor }) => {
          editor.chain().focus().splitCell().run();
        }
      },
      {
        title: "Delete Table",
        description: "Remove entire table",
        icon: "fa-trash",
        command: ({ editor }) => {
          editor.chain().focus().deleteTable().run();
        }
      }
    ]
  },
  {
    title: "Media & Links",
    description: "Insert images, links and media",
    icon: "fa-image",
    submenu: [
      {
        title: "Link",
        description: "Insert a hyperlink",
        icon: "fa-link",
        command: ({ editor, range }) => {
          const url = prompt("Enter URL:");

          if (url) {
            editor.chain().focus().deleteRange(range).setLink({ href: url }).run();
          }
        }
      },
      {
        title: "Upload Image",
        description: "Upload and insert an image",
        icon: "fa-image",
        command: ({ editor, range }) => {
          const input = document.createElement("input");

          input.type = "file";
          input.accept = "image/*";

          input.onchange = async () => {
            const file = input.files?.[0];

            if (file) {
              const reader = new FileReader();

              reader.onload = () => {
                const imageAttributes: TipTapImageAttributes = {
                  src: reader.result as string,
                  alt: file.name,
                  title: "",
                  width: "320",
                  height: "auto",
                  style: "float: none"
                };

                editor.chain().focus().deleteRange(range).setImage(imageAttributes).run();
              };
              reader.readAsDataURL(file);
            }
          };

          input.click();
        }
      },
      {
        title: "Image by URL",
        description: "Insert an image from URL",
        icon: "fa-link",
        command: ({ editor, range }) => {
          const url = prompt("Enter image URL:");

          if (url) {
            const attrs: TipTapImageAttributes = { src: url };

            editor.chain().focus().deleteRange(range).setImage(attrs).run();
          }
        }
      },
      {
        title: "YouTube Video",
        description: "Embed a YouTube video",
        icon: "fa-video",
        command: ({ editor, range }) => {
          const url = prompt("Enter YouTube URL:");

          if (url) {
            editor.chain().focus().deleteRange(range).setYoutubeVideo({ src: url }).run();
          }
        }
      }
    ]
  }
];

export const renderItems = () => {
  let component: ReactRenderer | null = null;
  let popup: any = null;

  return {
    onStart: (props: any) => {
      component = new ReactRenderer(CommandList, {
        props,
        editor: props.editor
      });

      if (!props.clientRect) {
        return;
      }

      const getAppendTarget = () => {
        const exerciseLayout = document.getElementById("exercise-layout");
        return exerciseLayout || document.body;
      };

      popup = tippy("body", {
        getReferenceClientRect: props.clientRect,
        appendTo: getAppendTarget,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start"
      });
    },

    onUpdate(props: any) {
      component?.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      popup?.[0].setProps({
        getReferenceClientRect: props.clientRect
      });
    },

    onKeyDown(props: any) {
      if (props.event.key === "Escape") {
        popup?.[0].hide();
        return true;
      }

      // Handle navigation keys
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(props.event.key)) {
        props.event.preventDefault();

        const commandListRef = (component as any)?.ref;

        if (commandListRef?.onKeyDown) {
          return commandListRef.onKeyDown(props.event);
        }
      }

      return false;
    },

    onExit() {
      popup?.[0].destroy();
      component?.destroy();
    }
  };
};

export const Command = Extension.create({
  name: "slash-command",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: any }) => {
          props.command({ editor, range });
        },
        items: ({ query }: { query: string }) => {
          return items.filter(
            (item) =>
              item.title.toLowerCase().includes(query.toLowerCase()) ||
              item.description.toLowerCase().includes(query.toLowerCase()) ||
              item.submenu?.some(
                (subitem) =>
                  subitem.title.toLowerCase().includes(query.toLowerCase()) ||
                  subitem.description.toLowerCase().includes(query.toLowerCase())
              )
          );
        },
        render: renderItems
      }
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion
      })
    ];
  }
});
