import React from "react";

import { ActiveCodeAnswerView } from "./ActiveCodeAnswerView";
import styles from "./AnswerViews.module.css";
import { DefaultAnswerView } from "./DefaultAnswerView";
import { FitbAnswerView } from "./FitbAnswerView";
import { McqAnswerView } from "./McqAnswerView";
import { ParsonsAnswerView } from "./ParsonsAnswerView";
import { RunestoneGraderPreview } from "./RunestoneGraderPreview";
import { ShortAnswerView } from "./ShortAnswerView";
import { AnswerRendererProps } from "./types";

const RUNESTONE_GRADER_TYPES = new Set([
  "mchoice",
  "clickablearea",
  "dragndrop",
  "fillintheblank",
  "shortanswer",
  "parsonsprob",
  "matching",
  "activecode",
  "actex",
  "codelens",
  "hparsons",
  "lp",
  "webwork",
  "selectquestion"
]);

export const AnswerRenderer: React.FC<AnswerRendererProps & { questionType: string }> = (props) => {
  const { questionType, htmlsrc, questionName, sid, history, activeAttemptIndex } = props;

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
          sid={sid}
          attempt={attempt}
          attemptId={attempt?.id ?? "latest"}
        />
      </section>
    ) : null;

  if (interactive) return <>{interactive}</>;

  switch (questionType) {
    case "mchoice":
    case "clickablearea":
    case "dragndrop":
      return <McqAnswerView {...props} />;
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
