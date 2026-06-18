import { renderHook, act } from "@testing-library/react";
import { useTableRowMenu } from "./useTableRowMenu";

const createMockEditor = (overrides: Record<string, unknown> = {}) => {
  return {
    isActive: vi.fn().mockReturnValue(true),
    state: {
      selection: {
        $anchor: {
          depth: 0,
          node: vi.fn().mockReturnValue(null)
        }
      }
    },
    ...overrides
  } as unknown as import("@tiptap/react").Editor;
};

describe("useTableRowMenu", () => {
  describe("initial state", () => {
    it("returns rowMenuVisible as false initially", () => {
      const { result } = renderHook(() => useTableRowMenu(null));
      expect(result.current.rowMenuVisible).toBe(false);
    });

    it("returns rowMenuPosition as { x: 0, y: 0 } initially", () => {
      const { result } = renderHook(() => useTableRowMenu(null));
      expect(result.current.rowMenuPosition).toEqual({ x: 0, y: 0 });
    });

    it("returns rowMenuRef as a ref object", () => {
      const { result } = renderHook(() => useTableRowMenu(null));
      expect(result.current.rowMenuRef).toBeDefined();
      expect(result.current.rowMenuRef).toHaveProperty("current");
    });

    it("returns currentRowElement as null initially", () => {
      const { result } = renderHook(() => useTableRowMenu(null));
      expect(result.current.currentRowElement).toBeNull();
    });

    it("returns setRowMenuVisible as a function", () => {
      const { result } = renderHook(() => useTableRowMenu(null));
      expect(typeof result.current.setRowMenuVisible).toBe("function");
    });

    it("returns getRowCount as a function", () => {
      const { result } = renderHook(() => useTableRowMenu(null));
      expect(typeof result.current.getRowCount).toBe("function");
    });

    it("returns isLastRow as a function", () => {
      const { result } = renderHook(() => useTableRowMenu(null));
      expect(typeof result.current.isLastRow).toBe("function");
    });
  });

  describe("setRowMenuVisible", () => {
    it("sets rowMenuVisible to true when called with true", () => {
      const { result } = renderHook(() => useTableRowMenu(null));
      act(() => {
        result.current.setRowMenuVisible(true);
      });
      expect(result.current.rowMenuVisible).toBe(true);
    });

    it("sets rowMenuVisible back to false when called with false", () => {
      const { result } = renderHook(() => useTableRowMenu(null));
      act(() => {
        result.current.setRowMenuVisible(true);
      });
      act(() => {
        result.current.setRowMenuVisible(false);
      });
      expect(result.current.rowMenuVisible).toBe(false);
    });
  });

  describe("getRowCount", () => {
    it("returns 0 when editor is null", () => {
      const { result } = renderHook(() => useTableRowMenu(null));
      expect(result.current.getRowCount()).toBe(0);
    });

    it("returns 0 when no table node is found at any depth", () => {
      const mockEditor = createMockEditor({
        state: {
          selection: {
            $anchor: {
              depth: 3,
              node: vi.fn().mockReturnValue({ type: { name: "paragraph" } })
            }
          }
        }
      });

      const { result } = renderHook(() => useTableRowMenu(mockEditor));
      expect(result.current.getRowCount()).toBe(0);
    });

    it("returns count of rows without header cells when table node is found", () => {
      const headerCell = { type: { name: "tableHeader" } };
      const dataCell = { type: { name: "tableCell" } };

      const headerRow = {
        type: { name: "tableRow" },
        forEach: (fn: (cell: typeof headerCell) => void) => {
          [headerCell].forEach(fn);
        }
      };

      const dataRow1 = {
        type: { name: "tableRow" },
        forEach: (fn: (cell: typeof dataCell) => void) => {
          [dataCell].forEach(fn);
        }
      };

      const dataRow2 = {
        type: { name: "tableRow" },
        forEach: (fn: (cell: typeof dataCell) => void) => {
          [dataCell].forEach(fn);
        }
      };

      const tableNode = {
        type: { name: "table" },
        forEach: (fn: (child: typeof headerRow | typeof dataRow1) => void) => {
          [headerRow, dataRow1, dataRow2].forEach(fn);
        }
      };

      const mockAnchorNode = vi.fn().mockReturnValue(tableNode);

      const mockEditor = createMockEditor({
        state: {
          selection: {
            $anchor: {
              depth: 1,
              node: mockAnchorNode
            }
          }
        }
      });

      const { result } = renderHook(() => useTableRowMenu(mockEditor));
      expect(result.current.getRowCount()).toBe(2);
    });

    it("returns 0 when table has only header rows", () => {
      const headerCell = { type: { name: "tableHeader" } };

      const headerRow = {
        type: { name: "tableRow" },
        forEach: (fn: (cell: typeof headerCell) => void) => {
          [headerCell].forEach(fn);
        }
      };

      const tableNode = {
        type: { name: "table" },
        forEach: (fn: (child: typeof headerRow) => void) => {
          [headerRow].forEach(fn);
        }
      };

      const mockAnchorNode = vi.fn().mockReturnValue(tableNode);

      const mockEditor = createMockEditor({
        state: {
          selection: {
            $anchor: {
              depth: 1,
              node: mockAnchorNode
            }
          }
        }
      });

      const { result } = renderHook(() => useTableRowMenu(mockEditor));
      expect(result.current.getRowCount()).toBe(0);
    });

    it("traverses from deepest ancestor to find table node", () => {
      const dataCell = { type: { name: "tableCell" } };
      const dataRow = {
        type: { name: "tableRow" },
        forEach: (fn: (cell: typeof dataCell) => void) => {
          [dataCell].forEach(fn);
        }
      };
      const tableNode = {
        type: { name: "table" },
        forEach: (fn: (child: typeof dataRow) => void) => {
          [dataRow].forEach(fn);
        }
      };

      const mockAnchorNode = vi.fn().mockImplementation((depth: number) => {
        if (depth === 2) return tableNode;
        return { type: { name: "paragraph" } };
      });

      const mockEditor = createMockEditor({
        state: {
          selection: {
            $anchor: {
              depth: 3,
              node: mockAnchorNode
            }
          }
        }
      });

      const { result } = renderHook(() => useTableRowMenu(mockEditor));
      expect(result.current.getRowCount()).toBe(1);
    });
  });

  describe("isLastRow", () => {
    it("returns true when getRowCount returns 1", () => {
      const dataCell = { type: { name: "tableCell" } };
      const dataRow = {
        type: { name: "tableRow" },
        forEach: (fn: (cell: typeof dataCell) => void) => {
          [dataCell].forEach(fn);
        }
      };
      const tableNode = {
        type: { name: "table" },
        forEach: (fn: (child: typeof dataRow) => void) => {
          [dataRow].forEach(fn);
        }
      };

      const mockAnchorNode = vi.fn().mockReturnValue(tableNode);
      const mockEditor = createMockEditor({
        state: {
          selection: {
            $anchor: {
              depth: 1,
              node: mockAnchorNode
            }
          }
        }
      });

      const { result } = renderHook(() => useTableRowMenu(mockEditor));
      expect(result.current.isLastRow()).toBe(true);
    });

    it("returns false when getRowCount returns more than 1", () => {
      const dataCell = { type: { name: "tableCell" } };

      const makeDataRow = () => ({
        type: { name: "tableRow" },
        forEach: (fn: (cell: typeof dataCell) => void) => {
          [dataCell].forEach(fn);
        }
      });

      const tableNode = {
        type: { name: "table" },
        forEach: (fn: (child: ReturnType<typeof makeDataRow>) => void) => {
          [makeDataRow(), makeDataRow()].forEach(fn);
        }
      };

      const mockAnchorNode = vi.fn().mockReturnValue(tableNode);
      const mockEditor = createMockEditor({
        state: {
          selection: {
            $anchor: {
              depth: 1,
              node: mockAnchorNode
            }
          }
        }
      });

      const { result } = renderHook(() => useTableRowMenu(mockEditor));
      expect(result.current.isLastRow()).toBe(false);
    });

    it("returns false when editor is null (row count is 0)", () => {
      const { result } = renderHook(() => useTableRowMenu(null));
      expect(result.current.isLastRow()).toBe(false);
    });
  });

  describe("click outside behavior", () => {
    it("closes menu on mousedown when click target is not inside the menu ref", () => {
      const { result } = renderHook(() => useTableRowMenu(null));

      act(() => {
        result.current.setRowMenuVisible(true);
      });

      expect(result.current.rowMenuVisible).toBe(true);

      const menuDiv = document.createElement("div");
      document.body.appendChild(menuDiv);
      Object.defineProperty(result.current.rowMenuRef, "current", {
        value: menuDiv,
        writable: true
      });

      const outsideElement = document.createElement("div");
      document.body.appendChild(outsideElement);

      act(() => {
        const event = new MouseEvent("mousedown", { bubbles: true });
        Object.defineProperty(event, "target", { value: outsideElement });
        document.dispatchEvent(event);
      });

      expect(result.current.rowMenuVisible).toBe(false);

      document.body.removeChild(menuDiv);
      document.body.removeChild(outsideElement);
    });

    it("does not add mousedown listener when menu is not visible", () => {
      const addSpy = vi.spyOn(document, "addEventListener");
      renderHook(() => useTableRowMenu(null));
      const mousedownCalls = addSpy.mock.calls.filter(([type]) => type === "mousedown");
      expect(mousedownCalls).toHaveLength(0);
      addSpy.mockRestore();
    });

    it("removes mousedown listener when menu becomes hidden", () => {
      const removeSpy = vi.spyOn(document, "removeEventListener");
      const { result } = renderHook(() => useTableRowMenu(null));

      act(() => {
        result.current.setRowMenuVisible(true);
      });

      act(() => {
        result.current.setRowMenuVisible(false);
      });

      const mousedownCalls = removeSpy.mock.calls.filter(([type]) => type === "mousedown");
      expect(mousedownCalls.length).toBeGreaterThan(0);
      removeSpy.mockRestore();
    });
  });

  describe("cleanup", () => {
    it("unmounts without error when editor is null", () => {
      const { unmount } = renderHook(() => useTableRowMenu(null));
      expect(() => unmount()).not.toThrow();
    });

    it("unmounts without error when editor is provided", () => {
      const mockEditor = createMockEditor();
      const { unmount } = renderHook(() => useTableRowMenu(mockEditor));
      expect(() => unmount()).not.toThrow();
    });
  });
});
