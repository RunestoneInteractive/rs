import React, { PropsWithChildren } from "react";

import { useRouteHeadingFocus } from "@/hooks/useRouteHeadingFocus";

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
  const pagePathname = pathname.replace(/\/students\/[^/]+\/?$/, "");
  const headingRef = useRouteHeadingFocus(pagePathname);

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
