import { PollType } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/PollTypes";
import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";

import { PollResults } from "@/types/exercises";
import { generatePollPreview } from "@/utils/preview/poll";

export interface PollPreviewProps {
  question: string;
  pollType: PollType;
  options: { id: string; choice: string }[];
  scaleMax: number;
  questionName: string;
  results?: PollResults;
}

export const PollPreview = ({
  question,
  pollType,
  options,
  scaleMax,
  questionName,
  results
}: PollPreviewProps) => {
  const previewOptions =
    pollType === "options"
      ? options.map((opt) => opt.choice)
      : Array.from({ length: scaleMax }, (_, i) => (i + 1).toString());

  return (
    <div style={{ display: "flex", alignItems: "start", justifyContent: "center" }}>
      <ExercisePreview
        htmlsrc={generatePollPreview(question, previewOptions, questionName, pollType, results)}
      />
    </div>
  );
};
