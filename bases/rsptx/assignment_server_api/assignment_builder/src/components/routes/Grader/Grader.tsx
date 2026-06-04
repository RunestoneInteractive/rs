import { Button, Tooltip } from "@mantine/core";
import React, { useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";

import { useGetAssignmentsQuery } from "@store/assignment/assignment.logic.api";
import {
  useGetGraderAnswersQuery,
  useGetGraderQuestionsQuery
} from "@store/grader/grader.logic.api";

import { ShortcutsHelpDialog } from "./components/ShortcutsHelpDialog";
import styles from "./Grader.module.css";
import { useEnsureEbookConfigForGrader } from "./hooks/useEnsureEbookConfigForGrader";
import { useGraderTour } from "./hooks/useGraderTour";
import { usePlatform } from "./hooks/usePlatform";
import { getQuestionProgress } from "./state/graderSelectors";
import { DEMO_ASSIGNMENTS, getDemoAnswersFor, getDemoQuestionsFor } from "./tour/graderDemoData";
import { GraderTourProvider, useGraderTourContext } from "./tour/GraderTourContext";

export const Grader: React.FC = () => {
  return (
    <GraderTourProvider>
      <GraderShell />
    </GraderTourProvider>
  );
};

const GraderShell: React.FC = () => {
  useEnsureEbookConfigForGrader();
  const { startTour } = useGraderTour();
  const params = useParams();
  const location = useLocation();
  const platform = usePlatform();
  const { data: realAssignments } = useGetAssignmentsQuery();
  const { isDemo } = useGraderTourContext();
  const assignments = isDemo ? DEMO_ASSIGNMENTS : realAssignments;

  const assignmentId = params.assignmentId ? Number(params.assignmentId) : undefined;
  const assignment = assignments?.find((a) => a.id === assignmentId);
  const questionId = params.questionId ? Number(params.questionId) : undefined;

  const { data: qRealData } = useGetGraderQuestionsQuery(assignmentId ?? 0, {
    skip: !assignmentId || isDemo
  });
  const { data: aRealData } = useGetGraderAnswersQuery(
    { assignmentId: assignmentId ?? 0, questionId: questionId ?? 0 },
    { skip: !assignmentId || !questionId || isDemo }
  );
  const qData = isDemo && assignmentId ? getDemoQuestionsFor(assignmentId) : qRealData;
  const aData =
    isDemo && assignmentId && questionId ? getDemoAnswersFor(assignmentId, questionId) : aRealData;
  const questionMeta = qData?.questions.find((q) => q.id === questionId);
  const progress = aData ? getQuestionProgress(aData.answers, questionMeta) : null;

  const [helpOpen, setHelpOpen] = useState(false);

  const shellClassName = questionId
    ? `${styles.graderShell} ${styles.graderShellFill}`
    : styles.graderShell;

  return (
    <div className={shellClassName}>
      <div className={styles.header}>
        <div className={styles.title} data-tour="grader-title">
          <span className={styles.titleText}>Assignment grader</span>
        </div>
        <div className={styles.headerActions}>
          <Tooltip label="Press ? for shortcuts" position="bottom">
            <Button
              data-tour="grader-shortcuts-btn"
              leftSection={<Icon name="bolt" size={14} />}
              variant="default"
              size="xs"
              onClick={() => setHelpOpen(true)}
            >
              Shortcuts
            </Button>
          </Tooltip>
          <Button
            data-tour="grader-take-tour-btn"
            leftSection={<Icon name="question-circle" size={14} />}
            variant="light"
            size="xs"
            onClick={startTour}
          >
            Take tour
          </Button>
        </div>
      </div>

      <nav className={styles.breadcrumb} aria-label="breadcrumb" data-tour="grader-breadcrumb">
        <Link to="/grader">Assignments</Link>
        {assignment && (
          <>
            <Icon name="angle-right" size={10} className={styles.breadcrumbSep} />
            <Link to={`/grader/${assignment.id}`}>{assignment.name}</Link>
          </>
        )}
        {assignment && questionId && (
          <>
            <Icon name="angle-right" size={10} className={styles.breadcrumbSep} />
            <span className={styles.breadcrumbCurrent}>
              Question #{questionId}
              {progress && (
                <span
                  className={styles.breadcrumbProgress}
                  aria-label={`${progress.graded + progress.autograded} of ${progress.total} students graded`}
                >
                  {progress.graded + progress.autograded}/{progress.total} graded
                </span>
              )}
            </span>
          </>
        )}
        <span className={styles.breadcrumbPath}>{location.pathname}</span>
      </nav>

      <div className={styles.body}>
        <Outlet />
      </div>

      <ShortcutsHelpDialog
        visible={helpOpen}
        onHide={() => setHelpOpen(false)}
        platform={platform}
      />
    </div>
  );
};

export default Grader;
