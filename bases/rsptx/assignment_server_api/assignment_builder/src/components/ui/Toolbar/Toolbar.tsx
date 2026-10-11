import { HTMLAttributes, ReactNode } from "react";

import styles from "./Toolbar.module.css";

interface ToolbarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  start?: ReactNode;
  end?: ReactNode;
}

export const Toolbar = ({ start, end, className, ...props }: ToolbarProps) => {
  const toolbarClassName = [styles.toolbar, className].filter(Boolean).join(" ");

  return (
    <div className={toolbarClassName} {...props}>
      {start != null && <div className={styles.start}>{start}</div>}
      {end != null && <div className={styles.end}>{end}</div>}
    </div>
  );
};
