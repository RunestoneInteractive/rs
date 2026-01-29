import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";
import { FC } from "react";

import { useFetchDatafilesQuery } from "@/store/datafile/datafile.logic.api";
import { ExistingDataFile, SelectedDataFile } from "@/types/datafile";
import { generateActiveCodePreview } from "@/utils/preview/activeCode";

interface ActiveCodePreviewProps {
  instructions: string;
  language: string;
  prefix_code: string;
  starter_code: string;
  suffix_code: string;
  name: string;
  stdin?: string;
  selectedExistingDataFiles?: SelectedDataFile[];
  enableCodeTailor?: boolean;
  parsonspersonalize?: "solution-level" | "block-and-solution" | "";
  parsonsexample?: string;
  enableCodelens?: boolean;
}

export const ActiveCodePreview: FC<ActiveCodePreviewProps> = ({
  instructions,
  language,
  prefix_code,
  starter_code,
  suffix_code,
  name,
  stdin,
  selectedExistingDataFiles = [],
  enableCodeTailor,
  parsonspersonalize,
  parsonsexample,
  enableCodelens
}) => {
  // Fetch datafiles list to get filenames for selected acids
  const { data: allDatafiles = [] } = useFetchDatafilesQuery();

  // Map selected files with existing file info
  const selectedDatafilesInfo = selectedExistingDataFiles
    .map((acid) => {
      const existingFile = allDatafiles.find((df: ExistingDataFile) => df.acid === acid);
      return {
        acid,
        filename: existingFile?.filename
      };
    })
    .filter((df) => df.acid);

  return (
    <div style={{ display: "flex", alignItems: "start", justifyContent: "center" }}>
      <ExercisePreview
        htmlsrc={generateActiveCodePreview(
          instructions,
          language,
          prefix_code,
          starter_code,
          suffix_code,
          name,
          stdin,
          selectedDatafilesInfo,
          {
            enableCodeTailor,
            parsonspersonalize,
            parsonsexample,
            enableCodelens
          }
        )}
      />
    </div>
  );
};
