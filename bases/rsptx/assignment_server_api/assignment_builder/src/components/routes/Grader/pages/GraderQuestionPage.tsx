import { Button, Center, Loader } from "@mantine/core";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";
import { notify } from "@/components/ui/notify";
import {
  GraderStudentAnswer,
  useGetGraderAnswersQuery,
  useGetGraderQuestionsQuery,
  useSaveGradeMutation
} from "@store/grader/grader.logic.api";

import { GradePanel, GradePanelHandle } from "../components/GradePanel";
import { DeadlineExceptionDialog } from "../components/DeadlineExceptionDialog";
import { RegradeWizard } from "../components/RegradeWizard";
import { ShortcutsHelpDialog } from "../components/ShortcutsHelpDialog";
import { StudentListSidebar } from "../components/StudentListSidebar";
import { SubmissionPane, SubmissionPaneHandle } from "../components/SubmissionPane";
import { AutoSavedInfo, useAutoSaveGrade } from "../hooks/useAutoSaveGrade";
import { useGraderHotkeys } from "../hooks/useGraderHotkeys";
import { useGraderPrefs } from "../hooks/useGraderPrefs";
import { usePlatform } from "../hooks/usePlatform";
import { useStudentNavigation } from "../hooks/useStudentNavigation";
import styles from "../Grader.module.css";
import { getDemoAnswersFor, getDemoQuestionsFor } from "../tour/graderDemoData";
import { useGraderTourContext } from "../tour/GraderTourContext";

export const GraderQuestionPage: React.FC = () => {
  const { assignmentId, questionId, sid } = useParams();
  const aid = Number(assignmentId);
  const qid = Number(questionId);
  const navigate = useNavigate();
  const location = useLocation();
  const platform = usePlatform();

  const { isDemo, demoSelected, setDemoSelected } = useGraderTourContext();

  const { data: qRealData } = useGetGraderQuestionsQuery(aid, {
    skip: !aid || isDemo
  });
  const { data: realData, isLoading } = useGetGraderAnswersQuery(
    { assignmentId: aid, questionId: qid },
    { skip: !aid || !qid || isDemo }
  );
  const data = isDemo ? (getDemoAnswersFor(aid, qid) ?? undefined) : realData;
  const qData = isDemo ? (getDemoQuestionsFor(aid) ?? undefined) : qRealData;
  const questionMeta = qData?.questions.find((q) => q.id === qid);

  const answers: ReadonlyArray<GraderStudentAnswer> = data?.answers ?? [];
  const activeSid = isDemo ? demoSelected?.sid : sid;

  const [dirtySids, setDirtySids] = useState<Set<string>>(new Set());

  const nav = useStudentNavigation({
    answers,
    question: questionMeta,
    dirtySids,
    questions: qData?.questions
  });

  useEffect(() => {
    if (isDemo) return;
    if (sid || !data) return;
    const selectLast = (location.state as { selectLast?: boolean } | null)?.selectLast === true;
    let targetSid: string | undefined;
    if (selectLast && answers.length) {
      targetSid = answers[answers.length - 1].sid;
    } else if (nav.firstUngraded) {
      targetSid = nav.firstUngraded;
    } else if (answers.length) {
      targetSid = answers[0].sid;
    }
    if (targetSid) {
      navigate(
        `/grader/${aid}/questions/${qid}/students/${encodeURIComponent(targetSid)}`,

        { replace: true, state: null }
      );
    }
  }, [isDemo, sid, data, nav.firstUngraded, answers, aid, qid, navigate, location.state]);

  const student = nav.current;

  const { prefs, updatePrefs } = useGraderPrefs();
  const notifIdRef = useRef<string | null>(null);
  const [revertGrade] = useSaveGradeMutation();

  const advanceTimerRef = useRef<number | null>(null);
  const cancelPendingAdvance = useCallback(() => {
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  const navRef = useRef(nav);
  useEffect(() => {
    navRef.current = nav;
  }, [nav]);
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  const questionNameRef = useRef<string>(data?.question.name ?? "");
  useEffect(() => {
    questionNameRef.current = data?.question.name ?? "";
  }, [data?.question.name]);

  const autoSaveRef = useRef<ReturnType<typeof useAutoSaveGrade> | null>(null);

  const undoSave = useCallback(
    async (info: AutoSavedInfo) => {
      cancelPendingAdvance();
      if (notifIdRef.current) {
        notify.hide(notifIdRef.current);
        notifIdRef.current = null;
      }
      try {
        if (!isDemo) {
          await revertGrade({
            sid: info.sid,
            div_id: info.questionName,
            score: info.previous.score,
            comment: info.previous.comment,
            questionId: info.questionId,
            assignmentId: aid
          }).unwrap();
        }
      } catch {}

      navRef.current.goTo(info.sid);

      autoSaveRef.current?.revertTo(info.previous);
    },
    [cancelPendingAdvance, isDemo, revertGrade, aid]
  );

  const handleSaved = useCallback(
    (info: AutoSavedInfo) => {
      const row = answersRef.current.find((a) => a.sid === info.sid);
      const displayName =
        row && (row.first_name || row.last_name)
          ? `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim()
          : info.sid;

      if (notifIdRef.current) {
        notify.hide(notifIdRef.current);
      }
      notifIdRef.current = notify.success({
        icon: <Icon name="check-circle" className={styles.toastIcon} />,
        autoClose: 5000,
        onClose: () => {
          notifIdRef.current = null;
        },
        message: (
          <div className={styles.toastBody}>
            <div className={styles.toastText}>
              <div className={styles.toastTitle}>Saved {displayName}</div>
              <div className={styles.toastSub}>
                {info.next.score} pt{info.next.score === 1 ? "" : "s"}
                {info.next.comment ? " · with comment" : ""}
              </div>
            </div>
            <Button
              leftSection={<Icon name="undo" size={14} />}
              variant="subtle"
              size="xs"
              onClick={() => undoSave(info)}
            >
              Undo
            </Button>
          </div>
        )
      });

      if (prefsRef.current.autoAdvance && navRef.current.hasNext) {
        cancelPendingAdvance();
        advanceTimerRef.current = window.setTimeout(() => {
          advanceTimerRef.current = null;

          navRef.current.goNextUngraded();
        }, 650);
      }
    },
    [cancelPendingAdvance, undoSave]
  );

  useEffect(() => () => cancelPendingAdvance(), [cancelPendingAdvance, qid]);

  const autoSave = useAutoSaveGrade({
    sid: student?.sid,
    assignmentId: aid,
    questionId: qid,
    questionName: data?.question.name ?? "",
    maxPoints: data?.question.max_points ?? 0,
    initialScore: student?.score ?? 0,
    initialComment: student?.comment ?? "",
    onSaved: handleSaved
  });

  useEffect(() => {
    autoSaveRef.current = autoSave;
  }, [autoSave]);

  useEffect(() => {
    if (!student?.sid) return;
    const id = student.sid;
    if (autoSave.status === "dirty" || autoSave.status === "saving") {
      cancelPendingAdvance();
      setDirtySids((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } else {
      setDirtySids((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [autoSave.status, student?.sid]);

  const [help, setHelp] = useState(false);
  const [hideGraded, setHideGraded] = useState(false);
  const [showRegrade, setShowRegrade] = useState(false);
  const [showExtraTime, setShowExtraTime] = useState(false);
  const gradePanelRef = useRef<GradePanelHandle>(null);
  const submissionRef = useRef<SubmissionPaneHandle>(null);

  useGraderHotkeys({
    next: async () => {
      cancelPendingAdvance();
      await autoSave.flush();
      nav.next();
    },
    prev: async () => {
      cancelPendingAdvance();
      await autoSave.flush();
      nav.prev();
    },
    nextAttempt: () => submissionRef.current?.nextAttempt(),
    prevAttempt: () => submissionRef.current?.prevAttempt(),
    focusGrade: () => gradePanelRef.current?.focusGrade(),
    focusComment: () => gradePanelRef.current?.focusComment(),
    toggleHideGraded: () => setHideGraded((v) => !v),
    openHelp: () => setHelp(true)
  });

  const selectSid = async (nextSid: string) => {
    if (nextSid === activeSid) return;
    cancelPendingAdvance();

    await autoSave.flush();
    if (isDemo) {
      const row = answers.find((a) => a.sid === nextSid);
      setDemoSelected(row ?? null);
    } else {
      navigate(`/grader/${aid}/questions/${qid}/students/${encodeURIComponent(nextSid)}`);
    }
  };

  const positionLabel = useMemo(() => {
    if (nav.currentIndex < 0) return undefined;
    return `${nav.currentIndex + 1} / ${nav.total}`;
  }, [nav.currentIndex, nav.total]);

  if (!data && isLoading) {
    return (
      <Center className={styles.loadingWrap}>
        <Loader />
      </Center>
    );
  }
  if (!data) {
    return (
      <div className={styles.emptyState}>Couldn't load student answers. Refresh the page.</div>
    );
  }

  return (
    <>
      {!isDemo && (
        <div className={styles.splitActions}>
          <Button
            leftSection={<Icon name="refresh" size={14} />}
            variant="default"
            size="xs"
            onClick={() => setShowRegrade(true)}
          >
            Regrade this question…
          </Button>
          <Button
            leftSection={<Icon name="clock" size={14} />}
            variant="default"
            size="xs"
            onClick={() => setShowExtraTime(true)}
          >
            Extra time…
          </Button>
        </div>
      )}
      {qData?.questions && (
        <RegradeWizard
          visible={showRegrade}
          onHide={() => setShowRegrade(false)}
          assignmentId={aid}
          questions={qData.questions}
          selectedQuestionIds={[qid]}
        />
      )}
      <DeadlineExceptionDialog
        visible={showExtraTime}
        onHide={() => setShowExtraTime(false)}
        assignmentId={aid}
        presetSids={activeSid ? [activeSid] : []}
      />
      <div className={styles.splitPane} data-tour="grader-split-pane">
        <StudentListSidebar
          answers={answers}
          question={questionMeta}
          activeSid={activeSid}
          dirtySids={dirtySids}
          onSelect={selectSid}
          hideGraded={hideGraded}
          onToggleHideGraded={setHideGraded}
        />

        <div className={styles.splitMain}>
          {!student ? (
            <div className={styles.splitGrid}>
              <div className={`${styles.emptyState} ${styles.emptyStateFill}`}>
                {answers.length === 0 ? (
                  <h3>No student answers yet</h3>
                ) : (
                  <h3>Select a student from the list to start grading</h3>
                )}
              </div>
              <GradePanel
                ref={gradePanelRef}
                student={null}
                maxPoints={data.question.max_points}
                score={0}
                comment=""
                status="idle"
                disabled
                hasPrev={nav.hasPrev}
                hasNext={nav.hasNext}
                positionLabel={positionLabel}
                onScoreChange={() => {}}
                onCommentChange={() => {}}
                onScoreBlur={() => {}}
                onCommentBlur={() => {}}
                onPrev={() => nav.prev()}
                onNext={() => nav.next()}
                onRetry={() => {}}
              />
            </div>
          ) : (
            <div className={styles.splitGrid}>
              <SubmissionPane
                ref={submissionRef}
                assignmentId={aid}
                questionId={qid}
                questionName={data.question.name}
                questionType={data.question.question_type}
                htmlsrc={data.question.htmlsrc || questionMeta?.htmlsrc}
                student={student}
              />
              <GradePanel
                ref={gradePanelRef}
                student={student}
                maxPoints={data.question.max_points}
                score={autoSave.score}
                comment={autoSave.comment}
                status={autoSave.status}
                errorMessage={autoSave.errorMessage}
                hasPrev={nav.hasPrev}
                hasNext={nav.hasNext}
                positionLabel={positionLabel}
                onScoreChange={autoSave.setScore}
                onCommentChange={autoSave.setComment}
                onScoreBlur={autoSave.flush}
                onCommentBlur={autoSave.flush}
                onPrev={async () => {
                  cancelPendingAdvance();
                  await autoSave.flush();
                  nav.prev();
                }}
                onNext={async () => {
                  cancelPendingAdvance();
                  await autoSave.flush();
                  nav.next();
                }}
                onRetry={autoSave.saveNow}
                autoAdvance={prefs.autoAdvance}
                onAutoAdvanceChange={(v) => updatePrefs({ autoAdvance: v })}
              />
            </div>
          )}
        </div>
      </div>

      <ShortcutsHelpDialog visible={help} onHide={() => setHelp(false)} platform={platform} />
    </>
  );
};

export default GraderQuestionPage;
