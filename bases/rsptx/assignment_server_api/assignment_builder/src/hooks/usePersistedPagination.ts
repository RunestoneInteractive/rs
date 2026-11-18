import { OnChangeFn, PaginationState } from "@tanstack/react-table";
import { useCallback, useEffect, useRef, useState } from "react";

interface PersistedPaginationOptions {
  /** Page size used when nothing is stored yet. */
  defaultPageSize?: number;
  /**
   * Number of rows the table currently holds. When provided, a restored page
   * index that no longer exists is clamped to the last available page.
   */
  rowCount?: number;
  /**
   * Identifies what the table is showing (an assignment id, say). A page index
   * is only restored for the scope it was stored under, so a different
   * assignment starts on the first page while keeping the rows-per-page
   * preference. Changing it on a mounted table resets the page the same way.
   */
  resetKey?: string | number;
}

const readNumber = (key: string): number | null => {
  try {
    const raw = window.localStorage.getItem(key);

    if (raw === null) {
      return null;
    }
    const parsed = Number(raw);

    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
};

const readString = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: number | string) => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage may be unavailable (private mode, blocked cookies); prefs are optional.
  }
};

const clamp = (pagination: PaginationState, rowCount?: number): PaginationState => {
  if (rowCount === undefined || pagination.pageSize <= 0) {
    return pagination;
  }
  const lastPageIndex = Math.max(0, Math.ceil(rowCount / pagination.pageSize) - 1);

  return pagination.pageIndex > lastPageIndex
    ? { ...pagination, pageIndex: lastPageIndex }
    : pagination;
};

/**
 * Table pagination state (page index and rows per page) persisted in
 * localStorage, so leaving a list and coming back lands on the same page.
 */
export const usePersistedPagination = (
  storageKeyPrefix: string,
  { defaultPageSize = 25, rowCount, resetKey }: PersistedPaginationOptions = {}
): [PaginationState, OnChangeFn<PaginationState>] => {
  const pageIndexKey = `${storageKeyPrefix}_pageIndex`;
  const pageSizeKey = `${storageKeyPrefix}_pageSize`;
  const scopeKey = `${storageKeyPrefix}_scope`;

  const [pagination, setPaginationState] = useState<PaginationState>(() => {
    const storedPageSize = readNumber(pageSizeKey);
    const sameScope = resetKey === undefined || readString(scopeKey) === String(resetKey);

    return {
      pageIndex: sameScope ? (readNumber(pageIndexKey) ?? 0) : 0,
      pageSize: storedPageSize && storedPageSize > 0 ? storedPageSize : defaultPageSize
    };
  });

  const [currentResetKey, setCurrentResetKey] = useState(resetKey);

  if (resetKey !== currentResetKey) {
    setCurrentResetKey(resetKey);
    setPaginationState((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }

  const rowCountRef = useRef(rowCount);

  rowCountRef.current = rowCount;

  const setPagination = useCallback<OnChangeFn<PaginationState>>((updater) => {
    setPaginationState((prev) => {
      const base = clamp(prev, rowCountRef.current);

      return clamp(typeof updater === "function" ? updater(base) : updater, rowCountRef.current);
    });
  }, []);

  // Persist the stored state rather than the clamped one: a filter that
  // temporarily shrinks the table shouldn't forget the page the user chose.
  useEffect(() => {
    write(pageIndexKey, pagination.pageIndex);
    write(pageSizeKey, pagination.pageSize);
    if (resetKey !== undefined) {
      write(scopeKey, String(resetKey));
    }
  }, [pageIndexKey, pageSizeKey, scopeKey, pagination, resetKey]);

  return [clamp(pagination, rowCount), setPagination];
};
