import React from "react";
import { Link } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";

import styles from "../Grader.module.css";

interface BreadcrumbAssignment {
  id: number;
  name: string;
}

interface BreadcrumbProgress {
  autograded: number;
  graded: number;
  total: number;
}

interface GraderBreadcrumbProps {
  assignment?: BreadcrumbAssignment;
  isGradebook: boolean;
  progress?: BreadcrumbProgress | null;
  questionId?: number;
}

const Separator: React.FC = () => (
  <Icon name="angle-right" size={10} className={styles.breadcrumbSep} />
);

export const GraderBreadcrumb: React.FC<GraderBreadcrumbProps> = ({
  assignment,
  isGradebook,
  progress,
  questionId
}) => {
  const assignmentsCurrent = !isGradebook && !assignment;

  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb" data-tour="grader-breadcrumb">
      <ol className={styles.breadcrumbList}>
        <li className={styles.breadcrumbItem}>
          {assignmentsCurrent ? (
            <span className={styles.breadcrumbCurrent} aria-current="page">
              Assignments
            </span>
          ) : (
            <Link to="/grader">Assignments</Link>
          )}
        </li>

        {isGradebook && (
          <li className={styles.breadcrumbItem}>
            <Separator />
            <span className={styles.breadcrumbCurrent} aria-current="page">
              Gradebook
            </span>
          </li>
        )}

        {assignment && (
          <li className={styles.breadcrumbItem}>
            <Separator />
            {questionId ? (
              <Link to={`/grader/${assignment.id}`}>{assignment.name}</Link>
            ) : (
              <span className={styles.breadcrumbCurrent} aria-current="page">
                {assignment.name}
              </span>
            )}
          </li>
        )}

        {assignment && questionId && (
          <li className={styles.breadcrumbItem}>
            <Separator />
            <span className={styles.breadcrumbCurrent} aria-current="page">
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
          </li>
        )}
      </ol>
    </nav>
  );
};

export default GraderBreadcrumb;
