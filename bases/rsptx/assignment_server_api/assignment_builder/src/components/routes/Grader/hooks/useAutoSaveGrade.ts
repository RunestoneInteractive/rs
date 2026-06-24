import debounce from "lodash/debounce";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSaveGradeMutation } from "@store/grader/grader.logic.api";

import { useGraderTourContext } from "../tour/GraderTourContext";

export type AutoSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface AutoSavedInfo {
  sid: string;
  questionId: number;
  questionName: string;

  previous: { score: number; comment: string };

  next: { score: number; comment: string };
}

interface Args {
  sid?: string;

  assignmentId: number;
  questionId: number;
  questionName: string;

  maxPoints: number;
  initialScore: number;
  initialComment: string;

  onSaved?: (info: AutoSavedInfo) => void;
}

interface Result {
  status: AutoSaveStatus;
  score: number;
  comment: string;
  setScore: (n: number) => void;
  setComment: (s: string) => void;

  flush: () => Promise<void>;

  saveNow: () => Promise<void>;

  revertTo: (prev: { score: number; comment: string }) => void;

  isDirty: boolean;
  lastSavedAt?: number;
  errorMessage?: string;
}

const SAVED_VISIBLE_MS = 1500;
const DEBOUNCE_MS = 700;

export const useAutoSaveGrade = (args: Args): Result => {
  const {
    sid,
    assignmentId,
    questionId,
    questionName,
    maxPoints,
    initialScore,
    initialComment,
    onSaved
  } = args;
  const { isDemo } = useGraderTourContext();
  const [saveGrade] = useSaveGradeMutation();

  const [score, setScoreState] = useState<number>(initialScore);
  const [comment, setCommentState] = useState<string>(initialComment);
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [lastSavedAt, setLastSavedAt] = useState<number | undefined>();

  const sidRef = useRef(sid);

  const lastSavedRef = useRef<{ score: number; comment: string }>({
    score: initialScore,
    comment: initialComment
  });
  useEffect(() => {
    sidRef.current = sid;
    setScoreState(initialScore);
    setCommentState(initialComment);
    setStatus("idle");
    setErrorMessage(undefined);
    lastSavedRef.current = { score: initialScore, comment: initialComment };
  }, [sid]);

  const valuesRef = useRef({ score, comment });
  useEffect(() => {
    valuesRef.current = { score, comment };
  }, [score, comment]);

  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const persist = useCallback(async () => {
    const targetSid = sidRef.current;
    if (!targetSid) return;
    const { score: s, comment: c } = valuesRef.current;
    const prev = lastSavedRef.current;

    if (s === prev.score && c === prev.comment) {
      setStatus("idle");
      return;
    }
    setStatus("saving");
    try {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 250));
      } else {
        await saveGrade({
          sid: targetSid,
          div_id: questionName,
          score: s,
          comment: c,
          questionId,
          assignmentId
        }).unwrap();
      }
      setStatus("saved");
      setLastSavedAt(Date.now());
      setErrorMessage(undefined);
      const previous = { ...prev };
      lastSavedRef.current = { score: s, comment: c };
      onSavedRef.current?.({
        sid: targetSid,
        questionId,
        questionName,
        previous,
        next: { score: s, comment: c }
      });
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string }; message?: string } | undefined;
      setStatus("error");
      setErrorMessage(err?.data?.detail || err?.message || "Save failed");
    }
  }, [isDemo, saveGrade, questionName, questionId, assignmentId]);

  const debounced = useMemo(
    () => debounce(persist, DEBOUNCE_MS, { leading: false, trailing: true }),
    [persist]
  );

  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => {
      setStatus((s) => (s === "saved" ? "idle" : s));
    }, SAVED_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [status, lastSavedAt]);

  useEffect(() => () => debounced.cancel(), [debounced]);

  const setScore = useCallback(
    (n: number) => {
      const clamped = Math.max(0, Math.min(maxPoints, isFinite(n) ? n : 0));
      setScoreState(clamped);
      setStatus("dirty");
      debounced();
    },
    [debounced, maxPoints]
  );

  const setComment = useCallback(
    (s: string) => {
      setCommentState(s);
      setStatus("dirty");
      debounced();
    },
    [debounced]
  );

  const flush = useCallback(async () => {
    if (status === "dirty") {
      debounced.cancel();
      await persist();
    }
  }, [status, debounced, persist]);

  const saveNow = useCallback(async () => {
    debounced.cancel();
    await persist();
  }, [debounced, persist]);

  const revertTo = useCallback(
    (prev: { score: number; comment: string }) => {
      debounced.cancel();
      setScoreState(prev.score);
      setCommentState(prev.comment);
      lastSavedRef.current = { score: prev.score, comment: prev.comment };
      valuesRef.current = { score: prev.score, comment: prev.comment };
      setStatus("idle");
      setErrorMessage(undefined);
    },
    [debounced]
  );

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  return {
    status,
    score,
    comment,
    setScore,
    setComment,
    flush,
    saveNow,
    revertTo,
    isDirty: status === "dirty" || status === "saving",
    lastSavedAt,
    errorMessage
  };
};
