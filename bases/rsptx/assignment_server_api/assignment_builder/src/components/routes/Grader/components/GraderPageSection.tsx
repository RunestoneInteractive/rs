import React, { PropsWithChildren, useEffect, useRef } from "react";

import styles from "../Grader.module.css";

interface GraderPageSectionProps extends PropsWithChildren {
  heading: string;
  pathname: string;
}

export const GraderPageSection: React.FC<GraderPageSectionProps> = ({
  children,
  heading,
  pathname
}) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pagePathname = pathname.replace(/\/students\/[^/]+\/?$/, "");

  useEffect(() => {
    headingRef.current?.focus();
  }, [pagePathname]);

  return (
    <section className={styles.body} aria-labelledby="grader-page-heading">
      <h2 ref={headingRef} id="grader-page-heading" className={styles.visuallyHidden} tabIndex={-1}>
        {heading}
      </h2>
      {children}
    </section>
  );
};

export default GraderPageSection;
