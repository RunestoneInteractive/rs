import { act, renderHook } from "@testing-library/react";

import { usePersistedPagination } from "./usePersistedPagination";

describe("usePersistedPagination", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts on the first page with the default page size", () => {
    const { result } = renderHook(() => usePersistedPagination("table"));

    expect(result.current[0]).toEqual({ pageIndex: 0, pageSize: 25 });
  });

  it("restores the stored page index and page size", () => {
    localStorage.setItem("table_pageIndex", "2");
    localStorage.setItem("table_pageSize", "50");

    const { result } = renderHook(() => usePersistedPagination("table", { rowCount: 200 }));

    expect(result.current[0]).toEqual({ pageIndex: 2, pageSize: 50 });
  });

  it("persists changes made through the setter", () => {
    const { result } = renderHook(() => usePersistedPagination("table"));

    act(() => result.current[1]((p) => ({ ...p, pageIndex: 3 })));

    expect(result.current[0].pageIndex).toBe(3);
    expect(localStorage.getItem("table_pageIndex")).toBe("3");

    act(() => result.current[1]({ pageIndex: 0, pageSize: 10 }));

    expect(localStorage.getItem("table_pageSize")).toBe("10");
    expect(localStorage.getItem("table_pageIndex")).toBe("0");
  });

  it("clamps a stored page index that no longer exists", () => {
    localStorage.setItem("table_pageIndex", "9");

    const { result } = renderHook(() => usePersistedPagination("table", { rowCount: 30 }));

    expect(result.current[0].pageIndex).toBe(1);
  });

  it("clamps to the first page when there are no rows", () => {
    localStorage.setItem("table_pageIndex", "4");

    const { result } = renderHook(() => usePersistedPagination("table", { rowCount: 0 }));

    expect(result.current[0].pageIndex).toBe(0);
  });

  it("hands the clamped page to functional updaters and stores a clamped result", () => {
    localStorage.setItem("table_pageIndex", "9");

    const { result } = renderHook(() => usePersistedPagination("table", { rowCount: 30 }));

    expect(result.current[0].pageIndex).toBe(1);

    act(() => result.current[1]((p) => ({ ...p, pageIndex: p.pageIndex + 1 })));

    expect(result.current[0].pageIndex).toBe(1);
    expect(localStorage.getItem("table_pageIndex")).toBe("1");
  });

  it("keeps the page size but drops the page when the scope changes", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => usePersistedPagination("table", { resetKey }),
      { initialProps: { resetKey: 1 } }
    );

    act(() => result.current[1]((p) => ({ ...p, pageIndex: 2, pageSize: 10 })));
    expect(localStorage.getItem("table_scope")).toBe("1");

    rerender({ resetKey: 2 });

    expect(result.current[0]).toEqual({ pageIndex: 0, pageSize: 10 });
    expect(localStorage.getItem("table_scope")).toBe("2");
  });

  it("only restores a stored page for the scope it was stored under", () => {
    localStorage.setItem("table_pageIndex", "2");
    localStorage.setItem("table_pageSize", "10");
    localStorage.setItem("table_scope", "1");

    const sameScope = renderHook(() => usePersistedPagination("table", { resetKey: 1 }));

    expect(sameScope.result.current[0]).toEqual({ pageIndex: 2, pageSize: 10 });
    sameScope.unmount();

    localStorage.setItem("table_pageIndex", "2");
    localStorage.setItem("table_scope", "1");

    const otherScope = renderHook(() => usePersistedPagination("table", { resetKey: 7 }));

    expect(otherScope.result.current[0]).toEqual({ pageIndex: 0, pageSize: 10 });
  });

  it("ignores unusable stored values", () => {
    localStorage.setItem("table_pageIndex", "not-a-number");
    localStorage.setItem("table_pageSize", "0");

    const { result } = renderHook(() => usePersistedPagination("table", { defaultPageSize: 10 }));

    expect(result.current[0]).toEqual({ pageIndex: 0, pageSize: 10 });
  });
});
