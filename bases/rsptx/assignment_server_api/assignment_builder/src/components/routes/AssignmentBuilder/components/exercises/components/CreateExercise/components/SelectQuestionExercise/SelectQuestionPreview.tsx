import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";
import { FC } from "react";

import { QuestionWithLabel } from "@/types/exercises";
import { generateSelectQuestionPreview } from "@/utils/preview/selectQuestionPreview";

interface SelectQuestionPreviewProps {
  name: string;
  questionList: QuestionWithLabel[];
  abExperimentName?: string;
  toggleOptions?: string[];
  dataLimitBasecourse?: boolean;
}

export const SelectQuestionPreview: FC<SelectQuestionPreviewProps> = ({
  name,
  questionList,
  abExperimentName,
  toggleOptions,
  dataLimitBasecourse
}) => {
  const htmlContent = generateSelectQuestionPreview({
    name,
    questionList,
    abExperimentName,
    toggleOptions,
    dataLimitBasecourse
  });

  return (
    <div className="flex flex-column gap-4">
      <div className="w-full">
        <ExercisePreview htmlsrc={htmlContent} />
      </div>
    </div>
  );
};
