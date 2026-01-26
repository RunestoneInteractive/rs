import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";
import { FC } from "react";

import { generateIframePreview } from "@/utils/preview/iframePreview";

interface IframePreviewProps {
  iframeSrc: string;
  name: string;
}

export const IframePreview: FC<IframePreviewProps> = ({ iframeSrc, name }) => {
  return (
    <div style={{ display: "flex", alignItems: "start", justifyContent: "center" }}>
      <ExercisePreview htmlsrc={generateIframePreview(iframeSrc || "", name || "")} />
    </div>
  );
};
