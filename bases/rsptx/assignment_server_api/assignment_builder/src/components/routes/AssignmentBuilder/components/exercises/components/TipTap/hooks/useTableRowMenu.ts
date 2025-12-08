import { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

interface UseTableRowMenuResult {
  rowMenuVisible: boolean;
  rowMenuPosition: { x: number; y: number };
  rowMenuRef: React.RefObject<HTMLDivElement>;
  currentRowElement: HTMLTableRowElement | null;
  setRowMenuVisible: (visible: boolean) => void;
  getRowCount: () => number;
  isLastRow: () => boolean;
}

export const useTableRowMenu = (editor: Editor | null): UseTableRowMenuResult => {
  const [rowMenuVisible, setRowMenuVisible] = useState(false);
  const [rowMenuPosition, setRowMenuPosition] = useState({ x: 0, y: 0 });
  const [currentRowElement, setCurrentRowElement] = useState<HTMLTableRowElement | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rowMenuRef.current && !rowMenuRef.current.contains(target)) {
        setRowMenuVisible(false);
      }
    };

    if (rowMenuVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [rowMenuVisible]);

  // Handle mouse leave from menu
  useEffect(() => {
    const handleMouseLeave = () => {
      if (hoverTimeout.current) {
        clearTimeout(hoverTimeout.current);
      }
      hoverTimeout.current = setTimeout(() => {
        setRowMenuVisible(false);
      }, 200); // Small delay to allow moving to the menu
    };

    const handleMouseEnter = () => {
      if (hoverTimeout.current) {
        clearTimeout(hoverTimeout.current);
      }
    };

    const menuElement = rowMenuRef.current;
    if (menuElement) {
      menuElement.addEventListener("mouseenter", handleMouseEnter);
      menuElement.addEventListener("mouseleave", handleMouseLeave);
      return () => {
        menuElement.removeEventListener("mouseenter", handleMouseEnter);
        menuElement.removeEventListener("mouseleave", handleMouseLeave);
      };
    }
  }, [rowMenuVisible]);

  // Handle table cell hover
  useEffect(() => {
    const handleTableCellHover = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const tableCell = target.closest("td");

      // Only process regular table cells, not headers
      if (!tableCell || target.closest("th")) {
        return;
      }

      const row = tableCell.closest("tr");
      if (!row || !editor?.isActive("table")) {
        return;
      }

      // Check if this is the first cell in the row
      const cells = Array.from(row.querySelectorAll("td"));
      const isFirstCell = cells[0] === tableCell;

      if (!isFirstCell) {
        return;
      }

      // Check if hovering over left part of the cell (first 30px)
      const rect = tableCell.getBoundingClientRect();
      const mouseX = event.clientX;
      const cellLeft = rect.left;
      const isLeftPart = mouseX - cellLeft < 30;

      if (isLeftPart) {
        if (hoverTimeout.current) {
          clearTimeout(hoverTimeout.current);
        }

        setRowMenuPosition({
          x: cellLeft - 5,
          y: rect.top + rect.height / 2
        });
        setCurrentRowElement(row as HTMLTableRowElement);
        setRowMenuVisible(true);
      }
    };

    const handleMouseLeave = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const tableCell = target.closest("td");

      if (tableCell) {
        if (hoverTimeout.current) {
          clearTimeout(hoverTimeout.current);
        }
        hoverTimeout.current = setTimeout(() => {
          // Check if mouse is over the menu
          const menuElement = rowMenuRef.current;
          if (menuElement) {
            const menuRect = menuElement.getBoundingClientRect();
            const mouseX = event.clientX;
            const mouseY = event.clientY;
            const isOverMenu =
              mouseX >= menuRect.left &&
              mouseX <= menuRect.right &&
              mouseY >= menuRect.top &&
              mouseY <= menuRect.bottom;

            if (!isOverMenu) {
              setRowMenuVisible(false);
            }
          } else {
            setRowMenuVisible(false);
          }
        }, 200);
      }
    };

    const editorElement = document.querySelector(".ProseMirror");
    if (editorElement && editor) {
      editorElement.addEventListener("mousemove", handleTableCellHover as EventListener);
      editorElement.addEventListener("mouseleave", handleMouseLeave as EventListener);
      return () => {
        editorElement.removeEventListener("mousemove", handleTableCellHover as EventListener);
        editorElement.removeEventListener("mouseleave", handleMouseLeave as EventListener);
        if (hoverTimeout.current) {
          clearTimeout(hoverTimeout.current);
        }
      };
    }
  }, [editor]);

  // Get the number of rows in the current table (excluding header)
  const getRowCount = () => {
    if (!editor) return 0;

    const { state } = editor;
    const { selection } = state;
    const { $anchor } = selection;

    // Find the table node
    for (let depth = $anchor.depth; depth > 0; depth--) {
      const node = $anchor.node(depth);
      if (node.type.name === "table") {
        // Count all rows, excluding header row
        let rowCount = 0;
        node.forEach((child) => {
          if (child.type.name === "tableRow") {
            // Check if this row contains header cells
            let hasHeaderCell = false;
            child.forEach((cell) => {
              if (cell.type.name === "tableHeader") {
                hasHeaderCell = true;
              }
            });
            if (!hasHeaderCell) {
              rowCount++;
            }
          }
        });
        return rowCount;
      }
    }
    return 0;
  };

  // Check if this is the last row
  const isLastRow = () => {
    return getRowCount() === 1;
  };

  return {
    rowMenuVisible,
    rowMenuPosition,
    rowMenuRef,
    currentRowElement,
    setRowMenuVisible,
    getRowCount,
    isLastRow
  };
};
