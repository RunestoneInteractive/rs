import { Button } from "primereact/button";
import React, { useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";

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
import {
  DEMO_ASSIGNMENTS,
  getDemoAnswersFor,
  getDemoQuestionsFor
} from "./tour/graderDemoData";
import {
  GraderTourProvider,
  useGraderTourContext
} from "./tour/GraderTourContext";

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
    isDemo && assignmentId && questionId
      ? getDemoAnswersFor(assignmentId, questionId)
      : aRealData;
  const questionMeta = qData?.questions.find((q) => q.id === questionId);
  const progress = aData ? getQuestionProgress(aData.answers, questionMeta) : null;

  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className={styles.graderShell}>
      <div className={styles.header}>
        <div className={styles.title} data-tour="grader-title">
          <span>Assignment Grader</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            data-tour="grader-shortcuts-btn"
            icon="pi pi-bolt"
            label="Shortcuts"
            outlined
            severity="secondary"
            onClick={() => setHelpOpen(true)}
            tooltip="Press ? for shortcuts"
            tooltipOptions={{ position: "bottom" }}
          />
          <Button
            data-tour="grader-take-tour-btn"
            icon="pi pi-question-circle"
            label="Take tour"
            outlined
            severity="info"
            onClick={startTour}
          />
        </div>
      </div>

      <nav
        className={styles.breadcrumb}
        aria-label="breadcrumb"
        data-tour="grader-breadcrumb"
      >
        <Link to="/grader">Assignments</Link>
        {assignment && (
          <>
            <i className="pi pi-angle-right" style={{ fontSize: 10 }} />
            <Link to={`/grader/${assignment.id}`}>{assignment.name}</Link>
          </>
        )}
        {assignment && questionId && (
          <>
            <i className="pi pi-angle-right" style={{ fontSize: 10 }} />
            <span style={{ color: "#0f172a", fontWeight: 600 }}>
              Question #{questionId}
              {progress && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#4f46e5",
                    background: "#eef2ff",
                    padding: "0.1rem 0.5rem",
                    borderRadius: 999
                  }}
                  aria-label={`${progress.graded + progress.autograded} of ${progress.total} students graded`}
                >
                  {progress.graded + progress.autograded}/{progress.total} graded
                </span>
              )}
            </span>
          </>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
          {location.pathname}
        </span>
      </nav>

      <Outlet />

      <ShortcutsHelpDialog
        visible={helpOpen}
        onHide={() => setHelpOpen(false)}
        platform={platform}
      />
    </div>
  );
};

export default Grader;
