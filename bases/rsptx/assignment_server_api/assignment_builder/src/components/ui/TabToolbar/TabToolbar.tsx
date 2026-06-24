import { ReactNode } from "react";

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
    <div className={styles.toolbar} data-scrolled={scrolled || undefined}>
      <div className={styles.titleGroup}>
        {leading}
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.countBadge}>{count}</span>
        {titleExtra}
      </div>
      <div className={styles.actions}>{children}</div>
    </div>
  );
};
