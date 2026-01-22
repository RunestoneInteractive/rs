import { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

interface UseTableColumnMenuResult {
  columnMenuVisible: boolean;
  columnMenuPosition: { x: number; y: number };
  columnMenuRef: React.RefObject<HTMLDivElement>;
  setColumnMenuVisible: (visible: boolean) => void;
  getColumnCount: () => number;
  isLastColumn: () => boolean;
}

export const useTableColumnMenu = (editor: Editor | null): UseTableColumnMenuResult => {
  const [columnMenuVisible, setColumnMenuVisible] = useState(false);
  const [columnMenuPosition, setColumnMenuPosition] = useState({ x: 0, y: 0 });
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setColumnMenuVisible(false);
      }
    };

    if (columnMenuVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [columnMenuVisible]);

  // Handle table header clicks
  useEffect(() => {
    const handleTableHeaderClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const tableHeader = target.closest("th");

      if (tableHeader && editor?.isActive("table")) {
        event.preventDefault();
        const rect = tableHeader.getBoundingClientRect();
        setColumnMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.bottom + 5
        });
        setColumnMenuVisible(true);
      }
    };

    const editorElement = document.querySelector(".ProseMirror");
    if (editorElement && editor) {
      editorElement.addEventListener("click", handleTableHeaderClick as EventListener);
      return () => {
        editorElement.removeEventListener("click", handleTableHeaderClick as EventListener);
      };
    }
  }, [editor]);

  // Get the number of columns in the current table
  const getColumnCount = () => {
    if (!editor) return 0;

    const { state } = editor;
    const { selection } = state;
    const { $anchor } = selection;

    // Find the table node
    for (let depth = $anchor.depth; depth > 0; depth--) {
      const node = $anchor.node(depth);
      if (node.type.name === "table") {
        // Get the first row to count columns
        const firstRow = node.firstChild;
        if (firstRow) {
          return firstRow.childCount;
        }
      }
    }
    return 0;
  };

  // Check if this is the last column
  const isLastColumn = () => {
    return getColumnCount() === 1;
  };

  return {
    columnMenuVisible,
    columnMenuPosition,
    columnMenuRef,
    setColumnMenuVisible,
    getColumnCount,
    isLastColumn
  };
};
