import { Editor } from "@tiptap/react";
import React from "react";
import defaultStyles from "../Editor.module.css";

interface TableRowMenuProps {
  editor: Editor;
  visible: boolean;
  position: { x: number; y: number };
  menuRef: React.RefObject<HTMLDivElement>;
  rowElement: HTMLTableRowElement | null;
  isLastRow: boolean;
  onClose: () => void;
  styles?: {
    rowMenu: string;
    rowMenuButton: string;
    rowMenuTooltip: string;
  };
}

export const TableRowMenu: React.FC<TableRowMenuProps> = ({
  editor,
  visible,
  position,
  menuRef,
  rowElement,
  isLastRow,
  onClose,
  styles = defaultStyles
}) => {
  if (!visible || !rowElement) return null;

  const handleAddRowBefore = () => {
    if (!rowElement) return;

    // Find the position of the clicked row in the table
    const table = rowElement.closest("table");
    if (!table) return;

    const rows = Array.from(table.querySelectorAll("tr"));
    const rowIndex = rows.indexOf(rowElement);

    if (rowIndex === -1) return;

    // Get the ProseMirror position for this row
    const { state, view } = editor;
    const { doc } = state;

    // Find the table node and calculate the position
    let tablePos = -1;
    doc.descendants((node, pos) => {
      if (node.type.name === "table") {
        const domNode = view.nodeDOM(pos);
        if (domNode === table) {
          tablePos = pos;
          return false;
        }
      }
    });

    if (tablePos === -1) return;

    // Calculate position by traversing rows
    let currentPos = tablePos + 1; // Start inside table
    for (let i = 0; i < rowIndex; i++) {
      const rowNode = doc.nodeAt(currentPos);
      if (rowNode) {
        currentPos += rowNode.nodeSize;
      }
    }

    // Set selection to inside the first cell of the target row
    const $pos = doc.resolve(currentPos + 2); // +1 for row, +1 for cell
    const tr = state.tr.setSelection(new (state.selection.constructor as any)($pos));

    editor.view.dispatch(tr);
    editor.chain().focus().addRowBefore().run();
    onClose();
  };

  const handleAddRowAfter = () => {
    if (!rowElement) return;

    const table = rowElement.closest("table");
    if (!table) return;

    const rows = Array.from(table.querySelectorAll("tr"));
    const rowIndex = rows.indexOf(rowElement);

    if (rowIndex === -1) return;

    const { state, view } = editor;
    const { doc } = state;

    let tablePos = -1;
    doc.descendants((node, pos) => {
      if (node.type.name === "table") {
        const domNode = view.nodeDOM(pos);
        if (domNode === table) {
          tablePos = pos;
          return false;
        }
      }
    });

    if (tablePos === -1) return;

    let currentPos = tablePos + 1;
    for (let i = 0; i < rowIndex; i++) {
      const rowNode = doc.nodeAt(currentPos);
      if (rowNode) {
        currentPos += rowNode.nodeSize;
      }
    }

    // Set selection to inside the first cell of the target row
    const $pos = doc.resolve(currentPos + 2); // +1 for row, +1 for cell
    const tr = state.tr.setSelection(new (state.selection.constructor as any)($pos));

    editor.view.dispatch(tr);
    editor.chain().focus().addRowAfter().run();
    onClose();
  };

  const handleDeleteRow = () => {
    if (!rowElement) return;

    if (isLastRow) {
      editor.chain().focus().deleteTable().run();
      onClose();
      return;
    }

    const table = rowElement.closest("table");
    if (!table) return;

    const rows = Array.from(table.querySelectorAll("tr"));
    const rowIndex = rows.indexOf(rowElement);

    if (rowIndex === -1) return;

    const { state, view } = editor;
    const { doc } = state;

    let tablePos = -1;
    doc.descendants((node, pos) => {
      if (node.type.name === "table") {
        const domNode = view.nodeDOM(pos);
        if (domNode === table) {
          tablePos = pos;
          return false;
        }
      }
    });

    if (tablePos === -1) return;

    let currentPos = tablePos + 1;
    for (let i = 0; i < rowIndex; i++) {
      const rowNode = doc.nodeAt(currentPos);
      if (rowNode) {
        currentPos += rowNode.nodeSize;
      }
    }

    // Set selection to inside the first cell of the target row
    const $pos = doc.resolve(currentPos + 2); // +1 for row, +1 for cell
    const tr = state.tr.setSelection(new (state.selection.constructor as any)($pos));

    editor.view.dispatch(tr);
    editor.chain().focus().deleteRow().run();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className={styles.rowMenu}
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-100%, -50%)"
      }}
    >
      <button className={styles.rowMenuButton} onClick={handleAddRowBefore}>
        <i className="fa-solid fa-circle-plus" />
        <span className={styles.rowMenuTooltip}>Add Row Above</span>
      </button>
      <button className={styles.rowMenuButton} onClick={handleAddRowAfter}>
        <i className="fa-solid fa-circle-plus" />
        <span className={styles.rowMenuTooltip}>Add Row Below</span>
      </button>
      <button className={styles.rowMenuButton} onClick={handleDeleteRow}>
        <i className="fa-solid fa-trash-can" />
        <span className={styles.rowMenuTooltip}>{isLastRow ? "Delete Table" : "Delete Row"}</span>
      </button>
    </div>
  );
};
