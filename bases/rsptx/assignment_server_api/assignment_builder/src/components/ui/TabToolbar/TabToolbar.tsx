import { ReactNode } from "react";

import { Toolbar } from "../Toolbar/Toolbar";

import styles from "./TabToolbar.module.css";

interface TabToolbarProps {
  title: string;
  count: number;
  scrolled?: boolean;
  leading?: ReactNode;
  titleExtra?: ReactNode;
  children?: ReactNode;
}

export const TabToolbar = ({
  title,
  count,
  scrolled = false,
  leading,
  titleExtra,
  children
}: TabToolbarProps) => {
  return (
    <Toolbar
      className={styles.toolbar}
      data-scrolled={scrolled || undefined}
      start={
        <div className={styles.titleGroup}>
          {leading}
          <h3 className={styles.title}>{title}</h3>
          <span className={styles.countBadge}>{count}</span>
          {titleExtra}
        </div>
      }
      end={children}
    />
  );
};
