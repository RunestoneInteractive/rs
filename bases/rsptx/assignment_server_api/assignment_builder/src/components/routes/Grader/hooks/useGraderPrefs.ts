import { useCallback, useEffect, useState } from "react";

export interface GraderPrefs {

  autoAdvance: boolean;
}

const STORAGE_KEY = "rs-grader-prefs-v1";

const DEFAULT_PREFS: GraderPrefs = {
  autoAdvance: false
};

const read = (): GraderPrefs => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<GraderPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
};

const write = (prefs: GraderPrefs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {

  }
};

export const useGraderPrefs = () => {
  const [prefs, setPrefsState] = useState<GraderPrefs>(() => read());

  const updatePrefs = useCallback((patch: Partial<GraderPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      write(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPrefsState(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { prefs, updatePrefs };
};

