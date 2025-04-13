import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";
import { FC } from "react";

import { generateActiveCodePreview } from "@/utils/preview/activeCode";

interface ActiveCodePreviewProps {
  instructions: string;
  language: string;
  prefix_code: string;
  starter_code: string;
  suffix_code: string;
  name: string;
}

export const ActiveCodePreview: FC<ActiveCodePreviewProps> = ({
  instructions,
  language,
  prefix_code,
  starter_code,
  suffix_code,
  name
}) => {
  return (
    <div style={{ display: "flex", alignItems: "start", justifyContent: "center" }}>
      <ExercisePreview
        htmlsrc={generateActiveCodePreview(
          instructions,
          language,
          prefix_code,
          starter_code,
          suffix_code,
          name
        )}
      />
    </div>
  );
};
