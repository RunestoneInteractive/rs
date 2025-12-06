import { Editor } from "@tiptap/react";
import React from "react";
import defaultStyles from "../Editor.module.css";

interface TableColumnMenuProps {
  editor: Editor;
  visible: boolean;
  position: { x: number; y: number };
  menuRef: React.RefObject<HTMLDivElement>;
  isLastColumn: boolean;
  onClose: () => void;
  styles?: {
    columnMenu: string;
    columnMenuButton: string;
  };
}

export const TableColumnMenu: React.FC<TableColumnMenuProps> = ({
  editor,
  visible,
  position,
  menuRef,
  isLastColumn,
  onClose,
  styles = defaultStyles
}) => {
  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className={styles.columnMenu}
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translateX(-50%)"
      }}
    >
      <button
        className={styles.columnMenuButton}
        onClick={() => {
          editor.chain().focus().addColumnBefore().run();
          onClose();
        }}
      >
        <i className="fa-solid fa-circle-plus" />
        <span>Add Column Left</span>
      </button>
      <button
        className={styles.columnMenuButton}
        onClick={() => {
          editor.chain().focus().addColumnAfter().run();
          onClose();
        }}
      >
        <i className="fa-solid fa-circle-plus" />
        <span>Add Column Right</span>
      </button>
      <button
        className={styles.columnMenuButton}
        onClick={() => {
          if (isLastColumn) {
            editor.chain().focus().deleteTable().run();
          } else {
            editor.chain().focus().deleteColumn().run();
          }
          onClose();
        }}
      >
        <i className="fa-solid fa-trash-can" />
        <span>{isLastColumn ? "Delete Table" : "Delete Column"}</span>
      </button>
    </div>
  );
};
