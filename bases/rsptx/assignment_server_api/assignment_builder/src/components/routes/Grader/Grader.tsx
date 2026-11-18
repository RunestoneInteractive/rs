import { Button, Tooltip } from "@mantine/core";
import { useGetAssignmentsQuery } from "@store/assignment/assignment.logic.api";
import {
  useGetGraderAnswersQuery,
  useGetGraderQuestionsQuery
} from "@store/grader/grader.logic.api";
import React, { useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";

import styles from "./Grader.module.css";
import { GraderBreadcrumb } from "./components/GraderBreadcrumb";
import { GraderPageSection } from "./components/GraderPageSection";
import { GraderSectionNav } from "./components/GraderSectionNav";
import { ShortcutsHelpDialog } from "./components/ShortcutsHelpDialog";
import { useEnsureEbookConfigForGrader } from "./hooks/useEnsureEbookConfigForGrader";
import { useGraderTour } from "./hooks/useGraderTour";
import { usePlatform } from "./hooks/usePlatform";
import { getQuestionProgress } from "./state/graderSelectors";
import { GraderTourProvider, useGraderTourContext } from "./tour/GraderTourContext";
import { DEMO_ASSIGNMENTS, getDemoAnswersFor, getDemoQuestionsFor } from "./tour/graderDemoData";

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
  const isGradebook = location.pathname.endsWith("/gradebook");
  const pageHeading = isGradebook
    ? "Gradebook"
    : questionId
      ? questionMeta?.name || `Question #${questionId}`
      : assignment?.name || "Assignments";

  const [helpOpen, setHelpOpen] = useState(false);

  const shellClassName = questionId
    ? `${styles.graderShell} ${styles.graderShellFill}`
    : styles.graderShell;

  return (
    <div className={shellClassName}>
      <header className={styles.header}>
        <h1 className={styles.title} data-tour="grader-title">
          <span className={styles.titleText}>Assignment grader</span>
        </h1>
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
      </header>

      <GraderSectionNav />

      <GraderBreadcrumb
        assignment={assignment}
        isGradebook={isGradebook}
        progress={progress}
        questionId={questionId}
      />

      <GraderPageSection heading={pageHeading} pathname={location.pathname}>
        <Outlet />
      </GraderPageSection>

      <ShortcutsHelpDialog
        visible={helpOpen}
        onHide={() => setHelpOpen(false)}
        platform={platform}
      />
    </div>
  );
};

export default Grader;
