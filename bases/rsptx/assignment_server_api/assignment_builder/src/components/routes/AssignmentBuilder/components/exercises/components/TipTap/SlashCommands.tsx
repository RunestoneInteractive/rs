import { TipTapImageAttributes } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Plugins/Image";
import { Editor, Extension, Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import React, { useCallback, useState, useImperativeHandle } from "react";
import tippy, { GetReferenceClientRect } from "tippy.js";

import styles from "./SlashCommands.module.css";
import { openInsertForm } from "./extensions/InsertFormBridge";

interface CommandItem {
  title: string;
  description: string;
  icon: string;
  kbd?: string;
  command?: ({ editor, range }: { editor: Editor; range: Range }) => void;
  submenu?: CommandItem[];
}

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
  editor: Editor;
  range: Range;
}

interface CommandListRef {
  selectItem: (index: number) => void;
  selectedIndex: number;
  onKeyDown: (e: React.KeyboardEvent) => boolean;
}

export const CommandList = React.forwardRef<CommandListRef, CommandListProps>(
  ({ items, command }, ref) => {
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
      <div
        className={styles.commandList}
        role="listbox"
        aria-label="Editor commands"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {items.map((item, index: number) => (
          <div key={index} className={styles.commandItemWrapper}>
            <button
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
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
              <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
              <div>
                <div className={styles.commandTitle}>{item.title}</div>
                <div className={styles.commandDescription}>{item.description}</div>
              </div>
              {item.kbd && <kbd className={styles.kbd}>{item.kbd}</kbd>}
              {item.submenu && (
                <i className={`fa-solid fa-chevron-right ${styles.chevron}`} aria-hidden="true" />
              )}
            </button>

            {showSubmenu === index && item.submenu && (
              <div className={styles.submenu} role="listbox" aria-label={item.title}>
                {item.submenu.map((submenuItem, submenuIndex: number) => (
                  <button
                    key={submenuIndex}
                    type="button"
                    role="option"
                    aria-selected={submenuIndex === submenuSelectedIndex}
                    className={styles.submenuItem}
                    onClick={() => selectSubmenuItem(submenuIndex)}
                    onMouseEnter={() => setSubmenuSelectedIndex(submenuIndex)}
                    data-selected={submenuIndex === submenuSelectedIndex}
                  >
                    <i className={`fa-solid ${submenuItem.icon}`} aria-hidden="true" />
                    <div>
                      <div className={styles.commandTitle}>{submenuItem.title}</div>
                      <div className={styles.commandDescription}>{submenuItem.description}</div>
                    </div>
                    {submenuItem.kbd && <kbd className={styles.kbd}>{submenuItem.kbd}</kbd>}
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
    title: "Text formatting",
    description: "Format text with bold, italic, etc.",
    icon: "fa-font",
    submenu: [
      {
        title: "Bold",
        description: "Make text bold",
        icon: "fa-bold",
        kbd: "Ctrl+B",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBold().run();
        }
      },
      {
        title: "Italic",
        description: "Make text italic",
        icon: "fa-italic",
        kbd: "Ctrl+I",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleItalic().run();
        }
      },
      {
        title: "Underline",
        description: "Underline text",
        icon: "fa-underline",
        kbd: "Ctrl+U",
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
        title: "Clear formatting",
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
        kbd: "#",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
        }
      },
      {
        title: "Heading 2",
        description: "Medium heading",
        icon: "fa-heading",
        kbd: "##",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
        }
      },
      {
        title: "Heading 3",
        description: "Small heading",
        icon: "fa-heading",
        kbd: "###",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
        }
      },
      {
        title: "Heading 4",
        description: "Extra small heading",
        icon: "fa-heading",
        kbd: "####",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 4 }).run();
        }
      }
    ]
  },
  {
    title: "Lists & structure",
    description: "Create lists and structure content",
    icon: "fa-list",
    submenu: [
      {
        title: "Bullet list",
        description: "Create a bullet list",
        icon: "fa-list-ul",
        kbd: "-",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        }
      },
      {
        title: "Numbered list",
        description: "Create a numbered list",
        icon: "fa-list-ol",
        kbd: "1.",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        }
      },
      {
        title: "Quote",
        description: "Add a blockquote",
        icon: "fa-quote-left",
        kbd: ">",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        }
      },
      {
        title: "Horizontal rule",
        description: "Add a horizontal line",
        icon: "fa-minus",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        }
      }
    ]
  },
  {
    title: "Code & math",
    description: "Insert code blocks and math expressions",
    icon: "fa-code",
    submenu: [
      {
        title: "Code block",
        description: "Insert a code block",
        icon: "fa-code",
        command: ({ editor, range }) => {
          openInsertForm(editor, "codeBlock", range);
        }
      },
      {
        title: "Inline code",
        description: "Insert inline code",
        icon: "fa-terminal",
        kbd: "`",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCode().run();
        }
      },
      {
        title: "Math expression",
        description: "Add mathematical formulas (LaTeX)",
        icon: "fa-square-root-variable",
        command: ({ editor, range }) => {
          openInsertForm(editor, "math", range);
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
        title: "Insert table",
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
        title: "Add column left",
        description: "Insert a column to the left",
        icon: "fa-table-columns",
        command: ({ editor }) => {
          editor.chain().focus().addColumnBefore().run();
        }
      },
      {
        title: "Add column right",
        description: "Insert a column to the right",
        icon: "fa-table-columns",
        command: ({ editor }) => {
          editor.chain().focus().addColumnAfter().run();
        }
      },
      {
        title: "Delete column",
        description: "Remove the current column",
        icon: "fa-table-columns",
        command: ({ editor }) => {
          editor.chain().focus().deleteColumn().run();
        }
      },
      {
        title: "Add row above",
        description: "Insert a row above",
        icon: "fa-table-rows",
        command: ({ editor }) => {
          editor.chain().focus().addRowBefore().run();
        }
      },
      {
        title: "Add row below",
        description: "Insert a row below",
        icon: "fa-table-rows",
        command: ({ editor }) => {
          editor.chain().focus().addRowAfter().run();
        }
      },
      {
        title: "Delete row",
        description: "Remove the current row",
        icon: "fa-table-rows",
        command: ({ editor }) => {
          editor.chain().focus().deleteRow().run();
        }
      },
      {
        title: "Toggle header row",
        description: "Toggle the header style of the first row",
        icon: "fa-heading",
        command: ({ editor }) => {
          editor.chain().focus().toggleHeaderRow().run();
        }
      },
      {
        title: "Merge cells",
        description: "Merge selected cells",
        icon: "fa-object-group",
        command: ({ editor }) => {
          editor.chain().focus().mergeCells().run();
        }
      },
      {
        title: "Split cell",
        description: "Split the merged cell",
        icon: "fa-object-ungroup",
        command: ({ editor }) => {
          editor.chain().focus().splitCell().run();
        }
      },
      {
        title: "Delete table",
        description: "Remove the entire table",
        icon: "fa-trash",
        command: ({ editor }) => {
          editor.chain().focus().deleteTable().run();
        }
      }
    ]
  },
  {
    title: "Media & links",
    description: "Insert images, links and media",
    icon: "fa-image",
    submenu: [
      {
        title: "Link",
        description: "Insert a hyperlink",
        icon: "fa-link",
        command: ({ editor, range }) => {
          openInsertForm(editor, "link", range);
        }
      },
      {
        title: "Upload image",
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
          openInsertForm(editor, "imageUrl", range);
        }
      },
      {
        title: "YouTube video",
        description: "Embed a YouTube video",
        icon: "fa-video",
        command: ({ editor, range }) => {
          openInsertForm(editor, "youtube", range);
        }
      }
    ]
  }
];

export const renderItems = () => {
  let component: ReactRenderer | null = null;
  let popup: ReturnType<typeof tippy> | null = null;

  return {
    onStart: (props: SuggestionProps) => {
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
        getReferenceClientRect: props.clientRect as GetReferenceClientRect,
        appendTo: getAppendTarget,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start"
      });
    },

    onUpdate(props: SuggestionProps) {
      component?.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      popup?.[0].setProps({
        getReferenceClientRect: props.clientRect as GetReferenceClientRect
      });
    },

    onKeyDown(props: SuggestionKeyDownProps) {
      if (props.event.key === "Escape") {
        popup?.[0].hide();
        return true;
      }

      // Handle navigation keys
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(props.event.key)) {
        props.event.preventDefault();

        const commandListRef = (component as ReactRenderer | null)?.ref as
          | CommandListRef
          | undefined;

        if (commandListRef?.onKeyDown) {
          return commandListRef.onKeyDown(props.event as unknown as React.KeyboardEvent);
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
        command: ({
          editor,
          range,
          props
        }: {
          editor: Editor;
          range: Range;
          props: CommandItem;
        }) => {
          props.command!({ editor, range });
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
