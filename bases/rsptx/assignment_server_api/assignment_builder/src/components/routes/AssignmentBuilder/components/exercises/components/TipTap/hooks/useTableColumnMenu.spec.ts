import { renderHook, act } from "@testing-library/react";
import { useTableColumnMenu } from "./useTableColumnMenu";

const createMockNode = (name: string, childCount: number, firstChild: object | null = null) => ({
  type: { name },
  childCount,
  firstChild
});

const createMockEditor = (
  isActive: boolean = true,
  depthNodes: Array<{ name: string; childCount: number; firstChild: object | null }> = []
) => {
  const mockDepthNodes = depthNodes;
  const depth = mockDepthNodes.length;

  return {
    isActive: vi.fn().mockReturnValue(isActive),
    state: {
      selection: {
        $anchor: {
          depth,
          node: vi.fn().mockImplementation((d: number) => {
            const index = depth - d;
            return mockDepthNodes[index] ?? createMockNode("unknown", 0, null);
          })
        }
      }
    }
  };
};

describe("useTableColumnMenu", () => {
  describe("initial state", () => {
    it("returns columnMenuVisible as false on mount", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));
      expect(result.current.columnMenuVisible).toBe(false);
    });

    it("returns columnMenuPosition as { x: 0, y: 0 } on mount", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));
      expect(result.current.columnMenuPosition).toEqual({ x: 0, y: 0 });
    });

    it("returns a columnMenuRef object", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));
      expect(result.current.columnMenuRef).toBeDefined();
      expect(result.current.columnMenuRef).toHaveProperty("current");
    });

    it("exposes setColumnMenuVisible function", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));
      expect(typeof result.current.setColumnMenuVisible).toBe("function");
    });

    it("exposes getColumnCount function", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));
      expect(typeof result.current.getColumnCount).toBe("function");
    });

    it("exposes isLastColumn function", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));
      expect(typeof result.current.isLastColumn).toBe("function");
    });
  });

  describe("setColumnMenuVisible", () => {
    it("sets columnMenuVisible to true when called with true", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));
      act(() => {
        result.current.setColumnMenuVisible(true);
      });
      expect(result.current.columnMenuVisible).toBe(true);
    });

    it("sets columnMenuVisible to false when called with false after being true", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));
      act(() => {
        result.current.setColumnMenuVisible(true);
      });
      act(() => {
        result.current.setColumnMenuVisible(false);
      });
      expect(result.current.columnMenuVisible).toBe(false);
    });
  });

  describe("getColumnCount", () => {
    it("returns 0 when editor is null", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));
      expect(result.current.getColumnCount()).toBe(0);
    });

    it("returns 0 when no table node found in ancestor chain", () => {
      const paragraphNode = createMockNode("paragraph", 2, null);
      const docNode = createMockNode("doc", 1, null);
      const editor = createMockEditor(true, [docNode, paragraphNode]);
      const { result } = renderHook(() => useTableColumnMenu(editor as any));
      expect(result.current.getColumnCount()).toBe(0);
    });

    it("returns 0 when table node has no first child", () => {
      const tableNode = createMockNode("table", 0, null);
      const docNode = createMockNode("doc", 1, null);
      const editor = createMockEditor(true, [docNode, tableNode]);
      const { result } = renderHook(() => useTableColumnMenu(editor as any));
      expect(result.current.getColumnCount()).toBe(0);
    });

    it("returns the childCount of the first row when table node is found", () => {
      const firstRow = { childCount: 3 };
      const tableNode = createMockNode("table", 1, firstRow);
      const docNode = createMockNode("doc", 1, null);
      const editor = createMockEditor(true, [docNode, tableNode]);
      const { result } = renderHook(() => useTableColumnMenu(editor as any));
      expect(result.current.getColumnCount()).toBe(3);
    });

    it("returns column count from deepest table node found", () => {
      const firstRow = { childCount: 5 };
      const tableNode = createMockNode("table", 1, firstRow);
      const cellNode = createMockNode("tableCell", 1, null);
      const docNode = createMockNode("doc", 1, null);
      const editor = createMockEditor(true, [docNode, tableNode, cellNode]);
      const { result } = renderHook(() => useTableColumnMenu(editor as any));
      expect(result.current.getColumnCount()).toBe(5);
    });
  });

  describe("isLastColumn", () => {
    it("returns true when getColumnCount returns 1", () => {
      const firstRow = { childCount: 1 };
      const tableNode = createMockNode("table", 1, firstRow);
      const docNode = createMockNode("doc", 1, null);
      const editor = createMockEditor(true, [docNode, tableNode]);
      const { result } = renderHook(() => useTableColumnMenu(editor as any));
      expect(result.current.isLastColumn()).toBe(true);
    });

    it("returns false when getColumnCount returns more than 1", () => {
      const firstRow = { childCount: 3 };
      const tableNode = createMockNode("table", 1, firstRow);
      const docNode = createMockNode("doc", 1, null);
      const editor = createMockEditor(true, [docNode, tableNode]);
      const { result } = renderHook(() => useTableColumnMenu(editor as any));
      expect(result.current.isLastColumn()).toBe(false);
    });

    it("returns false when editor is null (column count is 0)", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));
      expect(result.current.isLastColumn()).toBe(false);
    });
  });

  describe("click outside handler", () => {
    it("closes the menu when a mousedown event occurs outside the menu ref element", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));

      const menuDiv = document.createElement("div");
      document.body.appendChild(menuDiv);

      Object.defineProperty(result.current.columnMenuRef, "current", {
        value: menuDiv,
        writable: true,
        configurable: true
      });

      act(() => {
        result.current.setColumnMenuVisible(true);
      });

      const outsideElement = document.createElement("div");
      document.body.appendChild(outsideElement);

      act(() => {
        outsideElement.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });

      expect(result.current.columnMenuVisible).toBe(false);

      document.body.removeChild(menuDiv);
      document.body.removeChild(outsideElement);
    });

    it("does not close the menu when a mousedown event occurs inside the menu ref element", () => {
      const { result } = renderHook(() => useTableColumnMenu(null));

      const menuDiv = document.createElement("div");
      const innerButton = document.createElement("button");
      menuDiv.appendChild(innerButton);
      document.body.appendChild(menuDiv);

      Object.defineProperty(result.current.columnMenuRef, "current", {
        value: menuDiv,
        writable: true,
        configurable: true
      });

      act(() => {
        result.current.setColumnMenuVisible(true);
      });

      act(() => {
        innerButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });

      expect(result.current.columnMenuVisible).toBe(true);

      document.body.removeChild(menuDiv);
    });

    it("does not register mousedown listener when menu is not visible", () => {
      const addEventListenerSpy = vi.spyOn(document, "addEventListener");
      renderHook(() => useTableColumnMenu(null));
      const mousedownCalls = addEventListenerSpy.mock.calls.filter(
        ([type]) => type === "mousedown"
      );
      expect(mousedownCalls.length).toBe(0);
      addEventListenerSpy.mockRestore();
    });
  });

  describe("table header click handler", () => {
    it("sets menu position and shows menu when clicking a th inside a table when editor is active", () => {
      const proseMirrorDiv = document.createElement("div");
      proseMirrorDiv.className = "ProseMirror";

      const table = document.createElement("table");
      const tbody = document.createElement("tbody");
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = "Header";

      tr.appendChild(th);
      tbody.appendChild(tr);
      table.appendChild(tbody);
      proseMirrorDiv.appendChild(table);
      document.body.appendChild(proseMirrorDiv);

      const editor = createMockEditor(true, []);
      const { result } = renderHook(() => useTableColumnMenu(editor as any));

      vi.spyOn(th, "getBoundingClientRect").mockReturnValue({
        left: 100,
        right: 200,
        top: 50,
        bottom: 80,
        width: 100,
        height: 30,
        x: 100,
        y: 50,
        toJSON: () => ({})
      });

      act(() => {
        th.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(result.current.columnMenuVisible).toBe(true);
      expect(result.current.columnMenuPosition).toEqual({ x: 150, y: 85 });

      document.body.removeChild(proseMirrorDiv);
    });

    it("does not show menu when clicking inside ProseMirror but not on a th element", () => {
      const editor = createMockEditor(true, []);
      const { result } = renderHook(() => useTableColumnMenu(editor as any));

      const proseMirrorDiv = document.createElement("div");
      proseMirrorDiv.className = "ProseMirror";

      const paragraph = document.createElement("p");
      paragraph.textContent = "Some text";
      proseMirrorDiv.appendChild(paragraph);
      document.body.appendChild(proseMirrorDiv);

      act(() => {
        paragraph.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(result.current.columnMenuVisible).toBe(false);

      document.body.removeChild(proseMirrorDiv);
    });

    it("does not show menu when editor is not active on a table", () => {
      const editor = createMockEditor(false, []);
      const { result } = renderHook(() => useTableColumnMenu(editor as any));

      const proseMirrorDiv = document.createElement("div");
      proseMirrorDiv.className = "ProseMirror";

      const table = document.createElement("table");
      const tbody = document.createElement("tbody");
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = "Header";

      tr.appendChild(th);
      tbody.appendChild(tr);
      table.appendChild(tbody);
      proseMirrorDiv.appendChild(table);
      document.body.appendChild(proseMirrorDiv);

      act(() => {
        th.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(result.current.columnMenuVisible).toBe(false);

      document.body.removeChild(proseMirrorDiv);
    });
  });
});
