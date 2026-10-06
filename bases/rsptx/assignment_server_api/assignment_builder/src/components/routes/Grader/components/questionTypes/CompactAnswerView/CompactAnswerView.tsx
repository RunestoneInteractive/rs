import React from "react";

import { formatCompactAnswer } from "./utils";

interface CompactAnswerViewProps {
  questionType: string;
  answer?: string | null;
  htmlsrc?: string;
}

export const CompactAnswerView: React.FC<CompactAnswerViewProps> = ({
  questionType,
  answer,
  htmlsrc
}) => <>{formatCompactAnswer(questionType, answer, htmlsrc) || "—"}</>;
