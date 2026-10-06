import React from "react";

import { ActiveCodeAnswerView } from "../ActiveCodeAnswerView";
import styles from "../AnswerViews.module.css";
import { AssociationAnswerView } from "../AssociationAnswerView";
import { DefaultAnswerView } from "../DefaultAnswerView";
import { FitbAnswerView } from "../FitbAnswerView";
import { IframeAnswerView } from "../IframeAnswerView";
import { McqAnswerView } from "../McqAnswerView";
import { ParsonsAnswerView } from "../ParsonsAnswerView";
import { RunestoneGraderPreview } from "../RunestoneGraderPreview";
import { ShortAnswerView } from "../ShortAnswerView";
import { AnswerRendererProps } from "../types";

import { IFRAME_TYPES, RUNESTONE_GRADER_TYPES } from "./constants";

export const AnswerRenderer: React.FC<AnswerRendererProps & { questionType: string }> = (props) => {
  const { questionType, htmlsrc, questionName, sid, history, activeAttemptIndex } = props;

  if (IFRAME_TYPES.has(questionType)) {
    return <IframeAnswerView {...props} />;
  }

  const hasIndex = typeof activeAttemptIndex === "number" && activeAttemptIndex >= 0;
  const isLatestAttempt = hasIndex && activeAttemptIndex === history.length - 1;

  const attempt = hasIndex && !isLatestAttempt ? history[activeAttemptIndex!] : null;

  const interactive =
    htmlsrc && RUNESTONE_GRADER_TYPES.has(questionType) ? (
      <section className={styles.interactiveSection}>
        <h4 className={styles.rendererTitle}>
          Question: <span className={styles.questionName}>{questionName}</span>
        </h4>
        <RunestoneGraderPreview
          key={`${sid}-${attempt?.id ?? "latest"}`}
          htmlsrc={htmlsrc}
          divId={questionName}
          questionType={questionType}
          sid={sid}
          attempt={attempt}
          attemptId={attempt?.id ?? "latest"}
        />
      </section>
    ) : null;

  if (interactive) {
    if (questionType === "matching" || questionType === "dragndrop") {
      return (
        <>
          {interactive}
          <AssociationAnswerView {...props} kind={questionType} showQuestionHeader={false} />
        </>
      );
    }

    return <>{interactive}</>;
  }

  switch (questionType) {
    case "mchoice":
    case "clickablearea":
      return <McqAnswerView {...props} />;
    case "dragndrop":
      return <AssociationAnswerView {...props} kind="dragndrop" />;
    case "matching":
      return <AssociationAnswerView {...props} kind="matching" />;
    case "fillintheblank":
      return <FitbAnswerView {...props} />;
    case "shortanswer":
      return <ShortAnswerView {...props} />;
    case "parsonsprob":
      return <ParsonsAnswerView {...props} />;
    case "activecode":
    case "codelens":
    case "actex":
      return <ActiveCodeAnswerView {...props} />;
    default:
      return <DefaultAnswerView {...props} />;
  }
};
