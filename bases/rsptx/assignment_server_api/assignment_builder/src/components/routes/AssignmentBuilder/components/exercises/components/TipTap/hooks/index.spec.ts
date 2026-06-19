import { renderHook, act } from "@testing-library/react";
import { useTableColumnMenu } from "./useTableColumnMenu";
import { useTableRowMenu } from "./useTableRowMenu";

const buildMockEditor = (overrides: Partial<{ isActive: () => boolean; state: object }> = {}) => ({
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
});

describe("useTableColumnMenu", () => {
  it("returns correct initial state when editor is null", () => {
    const { result } = renderHook(() => useTableColumnMenu(null));

    expect(result.current.columnMenuVisible).toBe(false);
    expect(result.current.columnMenuPosition).toEqual({ x: 0, y: 0 });
    expect(result.current.columnMenuRef).toBeDefined();
    expect(typeof result.current.setColumnMenuVisible).toBe("function");
    expect(typeof result.current.getColumnCount).toBe("function");
    expect(typeof result.current.isLastColumn).toBe("function");
  });

  it("setColumnMenuVisible updates columnMenuVisible to true", () => {
    const { result } = renderHook(() => useTableColumnMenu(null));

    act(() => {
      result.current.setColumnMenuVisible(true);
    });

    expect(result.current.columnMenuVisible).toBe(true);
  });

  it("setColumnMenuVisible updates columnMenuVisible to false", () => {
    const { result } = renderHook(() => useTableColumnMenu(null));

    act(() => {
      result.current.setColumnMenuVisible(true);
    });
    act(() => {
      result.current.setColumnMenuVisible(false);
    });

    expect(result.current.columnMenuVisible).toBe(false);
  });

  it("getColumnCount returns 0 when editor is null", () => {
    const { result } = renderHook(() => useTableColumnMenu(null));

    expect(result.current.getColumnCount()).toBe(0);
  });

  it("isLastColumn returns true when getColumnCount returns 1", () => {
    const mockEditor = buildMockEditor({
      state: {
        selection: {
          $anchor: {
            depth: 1,
            node: vi.fn().mockReturnValue({
              type: { name: "table" },
              firstChild: { childCount: 1 }
            })
          }
        }
      }
    }) as unknown as import("@tiptap/react").Editor;

    const { result } = renderHook(() => useTableColumnMenu(mockEditor));

    expect(result.current.isLastColumn()).toBe(true);
  });

  it("isLastColumn returns false when there are multiple columns", () => {
    const mockEditor = buildMockEditor({
      state: {
        selection: {
          $anchor: {
            depth: 1,
            node: vi.fn().mockReturnValue({
              type: { name: "table" },
              firstChild: { childCount: 3 }
            })
          }
        }
      }
    }) as unknown as import("@tiptap/react").Editor;

    const { result } = renderHook(() => useTableColumnMenu(mockEditor));

    expect(result.current.isLastColumn()).toBe(false);
  });

  it("getColumnCount traverses depth levels and returns first row child count", () => {
    const nodeAtDepth2 = {
      type: { name: "table" },
      firstChild: { childCount: 4 }
    };
    const nodeAtDepth1 = { type: { name: "tableBody" }, firstChild: null };

    const mockAnchor = {
      depth: 2,
      node: vi.fn().mockImplementation((depth: number) => {
        if (depth === 2) return nodeAtDepth2;
        return nodeAtDepth1;
      })
    };

    const mockEditor = buildMockEditor({
      state: { selection: { $anchor: mockAnchor } }
    }) as unknown as import("@tiptap/react").Editor;

    const { result } = renderHook(() => useTableColumnMenu(mockEditor));

    expect(result.current.getColumnCount()).toBe(4);
  });

  it("getColumnCount returns 0 when table has no firstChild", () => {
    const mockAnchor = {
      depth: 1,
      node: vi.fn().mockReturnValue({
        type: { name: "table" },
        firstChild: null
      })
    };

    const mockEditor = buildMockEditor({
      state: { selection: { $anchor: mockAnchor } }
    }) as unknown as import("@tiptap/react").Editor;

    const { result } = renderHook(() => useTableColumnMenu(mockEditor));

    expect(result.current.getColumnCount()).toBe(0);
  });

  it("getColumnCount returns 0 when no table node is found in ancestors", () => {
    const mockAnchor = {
      depth: 2,
      node: vi.fn().mockReturnValue({
        type: { name: "paragraph" },
        firstChild: null
      })
    };

    const mockEditor = buildMockEditor({
      state: { selection: { $anchor: mockAnchor } }
    }) as unknown as import("@tiptap/react").Editor;

    const { result } = renderHook(() => useTableColumnMenu(mockEditor));

    expect(result.current.getColumnCount()).toBe(0);
  });

  it("attaches mousedown listener when menu becomes visible and removes it when hidden", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { result } = renderHook(() => useTableColumnMenu(null));

    act(() => {
      result.current.setColumnMenuVisible(true);
    });

    const addCalls = addSpy.mock.calls.filter(([event]) => event === "mousedown");
    expect(addCalls).toHaveLength(1);

    act(() => {
      result.current.setColumnMenuVisible(false);
    });

    const removeCalls = removeSpy.mock.calls.filter(([event]) => event === "mousedown");
    expect(removeCalls).toHaveLength(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("does not attach click-outside listener when menu is not visible initially", () => {
    const addSpy = vi.spyOn(document, "addEventListener");

    renderHook(() => useTableColumnMenu(null));

    const mousedownCalls = addSpy.mock.calls.filter(([event]) => event === "mousedown");
    expect(mousedownCalls).toHaveLength(0);

    addSpy.mockRestore();
  });
});

describe("useTableRowMenu", () => {
  it("returns correct initial state when editor is null", () => {
    const { result } = renderHook(() => useTableRowMenu(null));

    expect(result.current.rowMenuVisible).toBe(false);
    expect(result.current.rowMenuPosition).toEqual({ x: 0, y: 0 });
    expect(result.current.rowMenuRef).toBeDefined();
    expect(result.current.currentRowElement).toBeNull();
    expect(typeof result.current.setRowMenuVisible).toBe("function");
    expect(typeof result.current.getRowCount).toBe("function");
    expect(typeof result.current.isLastRow).toBe("function");
  });

  it("setRowMenuVisible updates rowMenuVisible to true", () => {
    const { result } = renderHook(() => useTableRowMenu(null));

    act(() => {
      result.current.setRowMenuVisible(true);
    });

    expect(result.current.rowMenuVisible).toBe(true);
  });

  it("setRowMenuVisible updates rowMenuVisible to false", () => {
    const { result } = renderHook(() => useTableRowMenu(null));

    act(() => {
      result.current.setRowMenuVisible(true);
    });
    act(() => {
      result.current.setRowMenuVisible(false);
    });

    expect(result.current.rowMenuVisible).toBe(false);
  });

  it("getRowCount returns 0 when editor is null", () => {
    const { result } = renderHook(() => useTableRowMenu(null));

    expect(result.current.getRowCount()).toBe(0);
  });

  it("isLastRow returns true when getRowCount returns 1", () => {
    const headerCell = { type: { name: "tableHeader" } };
    const dataCell = { type: { name: "tableCell" } };

    const headerRow = {
      type: { name: "tableRow" },
      forEach: vi.fn().mockImplementation((cb: (cell: object) => void) => cb(headerCell))
    };
    const dataRow = {
      type: { name: "tableRow" },
      forEach: vi.fn().mockImplementation((cb: (cell: object) => void) => cb(dataCell))
    };

    const tableNode = {
      type: { name: "table" },
      forEach: vi.fn().mockImplementation((cb: (child: object) => void) => {
        cb(headerRow);
        cb(dataRow);
      })
    };

    const mockAnchor = {
      depth: 1,
      node: vi.fn().mockReturnValue(tableNode)
    };

    const mockEditor = buildMockEditor({
      state: { selection: { $anchor: mockAnchor } }
    }) as unknown as import("@tiptap/react").Editor;

    const { result } = renderHook(() => useTableRowMenu(mockEditor));

    expect(result.current.isLastRow()).toBe(true);
    expect(result.current.getRowCount()).toBe(1);
  });

  it("isLastRow returns false when there are multiple data rows", () => {
    const dataCell = { type: { name: "tableCell" } };

    const makeDataRow = () => ({
      type: { name: "tableRow" },
      forEach: vi.fn().mockImplementation((cb: (cell: object) => void) => cb(dataCell))
    });

    const tableNode = {
      type: { name: "table" },
      forEach: vi.fn().mockImplementation((cb: (child: object) => void) => {
        cb(makeDataRow());
        cb(makeDataRow());
        cb(makeDataRow());
      })
    };

    const mockAnchor = {
      depth: 1,
      node: vi.fn().mockReturnValue(tableNode)
    };

    const mockEditor = buildMockEditor({
      state: { selection: { $anchor: mockAnchor } }
    }) as unknown as import("@tiptap/react").Editor;

    const { result } = renderHook(() => useTableRowMenu(mockEditor));

    expect(result.current.isLastRow()).toBe(false);
    expect(result.current.getRowCount()).toBe(3);
  });

  it("getRowCount returns 0 when no table node is found in ancestors", () => {
    const mockAnchor = {
      depth: 2,
      node: vi.fn().mockReturnValue({ type: { name: "paragraph" }, forEach: vi.fn() })
    };

    const mockEditor = buildMockEditor({
      state: { selection: { $anchor: mockAnchor } }
    }) as unknown as import("@tiptap/react").Editor;

    const { result } = renderHook(() => useTableRowMenu(mockEditor));

    expect(result.current.getRowCount()).toBe(0);
  });

  it("getRowCount excludes rows that contain header cells", () => {
    const headerCell = { type: { name: "tableHeader" } };
    const dataCell = { type: { name: "tableCell" } };

    const headerRow = {
      type: { name: "tableRow" },
      forEach: vi.fn().mockImplementation((cb: (cell: object) => void) => {
        cb(headerCell);
        cb(headerCell);
      })
    };
    const dataRow1 = {
      type: { name: "tableRow" },
      forEach: vi.fn().mockImplementation((cb: (cell: object) => void) => {
        cb(dataCell);
        cb(dataCell);
      })
    };
    const dataRow2 = {
      type: { name: "tableRow" },
      forEach: vi.fn().mockImplementation((cb: (cell: object) => void) => {
        cb(dataCell);
        cb(dataCell);
      })
    };

    const tableNode = {
      type: { name: "table" },
      forEach: vi.fn().mockImplementation((cb: (child: object) => void) => {
        cb(headerRow);
        cb(dataRow1);
        cb(dataRow2);
      })
    };

    const mockAnchor = {
      depth: 1,
      node: vi.fn().mockReturnValue(tableNode)
    };

    const mockEditor = buildMockEditor({
      state: { selection: { $anchor: mockAnchor } }
    }) as unknown as import("@tiptap/react").Editor;

    const { result } = renderHook(() => useTableRowMenu(mockEditor));

    expect(result.current.getRowCount()).toBe(2);
  });

  it("attaches mousedown listener when menu becomes visible and removes it when hidden", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { result } = renderHook(() => useTableRowMenu(null));

    act(() => {
      result.current.setRowMenuVisible(true);
    });

    const addCalls = addSpy.mock.calls.filter(([event]) => event === "mousedown");
    expect(addCalls).toHaveLength(1);

    act(() => {
      result.current.setRowMenuVisible(false);
    });

    const removeCalls = removeSpy.mock.calls.filter(([event]) => event === "mousedown");
    expect(removeCalls).toHaveLength(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe("re-exports from index", () => {
  it("exports useTableColumnMenu", async () => {
    const mod = await import("./index");
    expect(typeof mod.useTableColumnMenu).toBe("function");
  });

  it("exports useTableRowMenu", async () => {
    const mod = await import("./index");
    expect(typeof mod.useTableRowMenu).toBe("function");
  });
});
