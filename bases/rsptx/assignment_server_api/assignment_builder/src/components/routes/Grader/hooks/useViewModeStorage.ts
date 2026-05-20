import { useCallback, useEffect, useState } from "react";

export function useViewModeStorage<TMode extends string>(
  storageKey: string,
  allowedModes: readonly TMode[],
  defaultMode: TMode
): [TMode, (mode: TMode) => void] {
  const readInitial = useCallback((): TMode => {
    if (typeof window === "undefined") return defaultMode;
    const stored = window.localStorage.getItem(storageKey);
    return stored && (allowedModes as readonly string[]).includes(stored)
      ? (stored as TMode)
      : defaultMode;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const [mode, setModeState] = useState<TMode>(readInitial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, mode);
  }, [storageKey, mode]);

  const setMode = useCallback((next: TMode) => {
    setModeState(next);
  }, []);

  return [mode, setMode];
}

