import { MathJaxWrapper } from "@components/routes/AssignmentBuilder/MathJaxWrapper";
import { MathJax } from "better-react-mathjax";
import { Button } from "primereact/button";
import { useState } from "react";

import styles from "./MultiChoiceOptionsWrapper.module.css";

interface StatementPreviewProps {
  statement: string;
}

export const StatementPreview = ({ statement }: StatementPreviewProps) => {
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  return (
    <div className={styles.statementPreview}>
      <div className={styles.statementHeader}>
        <h4>Question Statement</h4>
        <Button
          icon={isVisible ? "pi pi-eye-slash" : "pi pi-eye"}
          size="small"
          outlined
          onClick={toggleVisibility}
          tooltip={isVisible ? "Hide preview" : "Show preview"}
          tooltipOptions={{ position: "left" }}
          aria-label={isVisible ? "Hide preview" : "Show preview"}
        />
      </div>
      {isVisible && (
        <div className={styles.statementContent}>
          <MathJaxWrapper>
            <MathJax>
              <div
                className={`${styles.statementBody} prose max-w-none`}
                dangerouslySetInnerHTML={{ __html: statement }}
              />
            </MathJax>
          </MathJaxWrapper>
        </div>
      )}
    </div>
  );
};
