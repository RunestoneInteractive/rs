import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";
import parse from "html-react-parser";

import { generateMultiChoicePreview } from "@/utils/preview/multichoice";

import { OptionWithId } from "./MultiChoiceOptions";

interface MultiChoicePreviewProps {
  question: string;
  options: OptionWithId[];
  questionName: string;
  forceCheckboxes?: boolean;
}

export const MultiChoicePreview = ({
  question,
  options,
  questionName,
  forceCheckboxes
}: MultiChoicePreviewProps) => {
  return (
    <div style={{ display: "flex", alignItems: "start", justifyContent: "center" }}>
      <ExercisePreview
        htmlsrc={generateMultiChoicePreview(question, options, questionName, forceCheckboxes)}
      />
    </div>
  );
};
