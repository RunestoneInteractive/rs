import { MathJaxWrapper } from "@components/routes/AssignmentBuilder/MathJaxWrapper";
import { MathJax } from "better-react-mathjax";

import styles from "./MultiChoiceOptionsWrapper.module.css";

interface StatementPreviewProps {
  statement: string;
}

export const StatementPreview = ({ statement }: StatementPreviewProps) => {
  return (
    <div className={styles.statementPreview}>
      <h4>Question Statement</h4>
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
    </div>
  );
};
