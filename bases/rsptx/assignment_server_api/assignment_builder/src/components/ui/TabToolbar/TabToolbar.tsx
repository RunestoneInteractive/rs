import { ReactNode } from "react";

import { Toolbar } from "../Toolbar/Toolbar";

import styles from "./TabToolbar.module.css";

interface TabToolbarProps {
  title: string;
  count: number;
  headingLevel?: 2 | 3;
  scrolled?: boolean;
  leading?: ReactNode;
  titleExtra?: ReactNode;
  children?: ReactNode;
}

export const TabToolbar = ({
  title,
  count,
  headingLevel = 3,
  scrolled = false,
  leading,
  titleExtra,
  children
}: TabToolbarProps) => {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <Toolbar
      className={styles.toolbar}
      data-scrolled={scrolled || undefined}
      start={
        <div className={styles.titleGroup}>
          {leading}
          <Heading className={styles.title}>{title}</Heading>
          <span className={styles.countBadge}>{count}</span>
          {titleExtra}
        </div>
      }
      end={children}
    />
  );
};
