import { useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  GraderQuestionStats,
  GraderStudentAnswer
} from "@store/grader/grader.logic.api";

import {
  findFirstUngradedSid,
  findNextUngradedSid
} from "../state/graderSelectors";
import { useGraderTourContext } from "../tour/GraderTourContext";

export interface StudentNavigation {
  current?: GraderStudentAnswer;
  currentIndex: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  prev: () => void;
  next: () => void;
  goTo: (sid: string) => void;

  goNextUngraded: () => boolean;
  firstUngraded?: string;
}

interface Options {
  answers: ReadonlyArray<GraderStudentAnswer>;
  question?: { autograde?: string };

  dirtySids?: ReadonlySet<string>;

  questions?: ReadonlyArray<GraderQuestionStats>;
}

export const useStudentNavigation = (opts: Options): StudentNavigation => {
  const { answers, question, dirtySids, questions } = opts;
  const params = useParams();
  const navigate = useNavigate();
  const { isDemo, demoSelected, setDemoSelected } = useGraderTourContext();

  const aid = Number(params.assignmentId);
  const qid = Number(params.questionId);
  const sidParam = params.sid;
  const activeSid = isDemo ? demoSelected?.sid : sidParam;

  const currentIndex = useMemo(() => {
    if (!activeSid) return -1;
    return answers.findIndex((a) => a.sid === activeSid);
  }, [activeSid, answers]);

  const current = currentIndex >= 0 ? answers[currentIndex] : undefined;
  const total = answers.length;
  const hasPrevStudent = currentIndex > 0;
  const hasNextStudent = currentIndex >= 0 && currentIndex < total - 1;

  const questionIndex = useMemo(() => {
    if (!questions || !qid) return -1;
    return questions.findIndex((q) => q.id === qid);
  }, [questions, qid]);
  const prevQuestion =
    questionIndex > 0 ? questions![questionIndex - 1] : undefined;
  const nextQuestion =
    questionIndex >= 0 && questions && questionIndex < questions.length - 1
      ? questions[questionIndex + 1]
      : undefined;

  const hasPrev = hasPrevStudent || !!prevQuestion;
  const hasNext = hasNextStudent || !!nextQuestion;

  const goTo = useCallback(
    (sid: string) => {
      if (isDemo) {
        const row = answers.find((a) => a.sid === sid) ?? null;
        setDemoSelected(row);
        return;
      }
      navigate(`/grader/${aid}/questions/${qid}/students/${encodeURIComponent(sid)}`);
    },
    [aid, qid, answers, isDemo, navigate, setDemoSelected]
  );

  const goToQuestion = useCallback(
    (targetQid: number, opts?: { selectLast?: boolean }) => {
      if (isDemo) return;
      navigate(`/grader/${aid}/questions/${targetQid}`, {

        state: opts?.selectLast ? { selectLast: true } : undefined
      });
    },
    [aid, isDemo, navigate]
  );

  const prev = useCallback(() => {
    if (hasPrevStudent) {
      goTo(answers[currentIndex - 1].sid);
    } else if (prevQuestion) {

      goToQuestion(prevQuestion.id, { selectLast: true });
    }
  }, [hasPrevStudent, currentIndex, answers, goTo, prevQuestion, goToQuestion]);

  const next = useCallback(() => {
    if (hasNextStudent) {
      goTo(answers[currentIndex + 1].sid);
    } else if (nextQuestion) {
      goToQuestion(nextQuestion.id);
    }
  }, [hasNextStudent, currentIndex, answers, goTo, nextQuestion, goToQuestion]);

  const goNextUngraded = useCallback((): boolean => {
    const nextSid = findNextUngradedSid(answers, currentIndex, question, {
      dirtySids
    });
    if (nextSid) {
      goTo(nextSid);
      return true;
    }
    if (hasNextStudent) {
      goTo(answers[currentIndex + 1].sid);
      return true;
    }
    if (nextQuestion) {
      goToQuestion(nextQuestion.id);
      return true;
    }
    return false;
  }, [
    answers,
    currentIndex,
    question,
    dirtySids,
    goTo,
    hasNextStudent,
    nextQuestion,
    goToQuestion
  ]);

  const firstUngraded = useMemo(
    () => findFirstUngradedSid(answers, question, { dirtySids }) ?? undefined,
    [answers, question, dirtySids]
  );

  return {
    current,
    currentIndex,
    total,
    hasPrev,
    hasNext,
    prev,
    next,
    goTo,
    goNextUngraded,
    firstUngraded
  };
};
