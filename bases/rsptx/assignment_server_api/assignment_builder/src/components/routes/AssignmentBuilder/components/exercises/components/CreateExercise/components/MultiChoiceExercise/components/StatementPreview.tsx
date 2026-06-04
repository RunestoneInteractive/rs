import { MathJaxWrapper } from "@components/routes/AssignmentBuilder/MathJaxWrapper";
import { ActionIcon, Tooltip } from "@mantine/core";
import { MathJax } from "better-react-mathjax";
import { useState } from "react";

import { Icon } from "@/components/ui/Icon";

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
        <h4>Question statement</h4>
        <Tooltip label={isVisible ? "Hide preview" : "Show preview"} position="left">
          <ActionIcon
            variant="outline"
            onClick={toggleVisibility}
            aria-label={isVisible ? "Hide preview" : "Show preview"}
          >
            <Icon name={isVisible ? "eye-slash" : "eye"} size={16} />
          </ActionIcon>
        </Tooltip>
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
