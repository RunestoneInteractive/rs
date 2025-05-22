import { TipTapImageAttributes } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Plugins/Image";
import { Editor, Extension, Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { useCallback, useState } from "react";
import tippy from "tippy.js";

import styles from "./SlashCommands.module.css";

interface CommandItem {
  title: string;
  description: string;
  icon: string;
  command: ({ editor, range }: { editor: Editor; range: Range }) => void;
}

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
  editor: Editor;
  range: Range;
}

const CommandList = ({ items, command, editor, range }: CommandListProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];

      if (item) {
        command(item);
      }
    },
    [items, command]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    const navigationKeys = ["ArrowUp", "ArrowDown", "Enter"];

    if (!navigationKeys.includes(e.key)) {
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((selectedIndex + items.length - 1) % items.length);
      return true;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((selectedIndex + 1) % items.length);
      return true;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      selectItem(selectedIndex);
      return true;
    }

    return false;
  };

  // Expose selectItem and selectedIndex for external use
  (CommandList as any).selectItem = selectItem;
  (CommandList as any).selectedIndex = selectedIndex;

  return (
    <div className={styles.commandList} onKeyDown={onKeyDown}>
      {items.map((item: any, index: number) => (
        <button
          className={styles.commandItem}
          key={index}
          onClick={() => selectItem(index)}
          data-selected={index === selectedIndex}
        >
          <i className={`fa-solid ${item.icon}`} />
          <div>
            <div className={styles.commandTitle}>{item.title}</div>
            <div className={styles.commandDescription}>{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
};

export const items: CommandItem[] = [
  {
    title: "Text",
    description: "Just start typing with plain text.",
    icon: "fa-text",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
    }
  },
  {
    title: "Bullet List",
    description: "Create a simple bullet list.",
    icon: "fa-list-ul",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    }
  },
  {
    title: "Numbered List",
    description: "Create a numbered list.",
    icon: "fa-list-ol",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    }
  },
  {
    title: "Upload Image",
    description: "Upload an image from your computer.",
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
    title: "Insert Image by URL",
    description: "Add an image from the internet using URL.",
    icon: "fa-link",
    command: ({ editor, range }) => {
      const url = window.prompt("Enter image URL:");

      if (url) {
        const img = new Image();

        img.onload = () => {
          const imageAttributes: TipTapImageAttributes = {
            src: url,
            alt: "Image from URL",
            title: "",
            width: "320",
            height: "auto",
            style: "float: none"
          };

          editor.chain().focus().deleteRange(range).setImage(imageAttributes).run();
        };
        img.onerror = () => {
          window.alert("Failed to load image. Please check the URL and try again.");
        };
        img.src = url;
      }
    }
  },
  {
    title: "YouTube Video",
    description: "Add a YouTube video.",
    icon: "fa-video",
    command: ({ editor, range }) => {
      const url = window.prompt("Enter YouTube video URL:");

      if (url) {
        const videoId = url.match(
          /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
        )?.[1];

        if (videoId) {
          editor.chain().focus().deleteRange(range).run();
          editor.commands.setYoutubeVideo({
            src: url,
            width: 320,
            height: 240
          });
        } else {
          window.alert("Invalid YouTube URL");
        }
      }
    }
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

      popup = tippy("body", {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start"
      });
    },

    onUpdate: (props: any) => {
      component?.updateProps(props);

      popup?.[0].setProps({
        getReferenceClientRect: props.clientRect
      });
    },

    onKeyDown: (props: { event: KeyboardEvent }) => {
      const { event } = props;

      if (event.key === "Escape") {
        if (popup?.[0] && !popup[0].state.isDestroyed) {
          popup[0].hide();
        }
        return true;
      }

      if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();

        if (event.key === "Enter") {
          const selectItem = (CommandList as any).selectItem;
          const selectedIndex = (CommandList as any).selectedIndex;

          if (selectItem && typeof selectedIndex === "number") {
            selectItem(selectedIndex);
            if (popup?.[0] && !popup[0].state.isDestroyed) {
              popup[0].hide();
            }
            return true;
          }
        }

        const commandList = popup?.[0]?.popper?.querySelector(`.${styles.commandList}`);

        if (commandList) {
          commandList.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: event.key,
              bubbles: true
            })
          );
          return true;
        }
      }

      return false;
    },

    onExit: () => {
      if (popup?.[0] && !popup[0].state.isDestroyed) {
        popup[0].destroy();
      }
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
              item.description.toLowerCase().includes(query.toLowerCase())
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
