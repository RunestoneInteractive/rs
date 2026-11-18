import React from "react";
import { Link, useLocation } from "react-router-dom";

import styles from "../Grader.module.css";

export const GraderSectionNav: React.FC = () => {
  const { pathname } = useLocation();
  const gradebookActive = pathname.endsWith("/gradebook");

  return (
    <nav className={styles.sectionNav} aria-label="Grader sections">
      <Link
        to="/grader"
        className={`${styles.sectionNavLink} ${gradebookActive ? "" : styles.sectionNavLinkActive}`}
        aria-current={gradebookActive ? undefined : "page"}
      >
        Assignments
      </Link>
      <Link
        to="/gradebook"
        className={`${styles.sectionNavLink} ${gradebookActive ? styles.sectionNavLinkActive : ""}`}
        aria-current={gradebookActive ? "page" : undefined}
      >
        Gradebook
      </Link>
    </nav>
  );
};

export default GraderSectionNav;
