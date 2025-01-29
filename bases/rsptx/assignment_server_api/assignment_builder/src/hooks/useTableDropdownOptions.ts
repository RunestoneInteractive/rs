import { datasetSelectors } from "@store/dataset/dataset.logic";
import { useSelector } from "react-redux";

import { DraggingExerciseDropdownColumns } from "@/types/components/editableTableCell";
import { TableDropdownOption } from "@/types/dataset";

export const useTableDropdownOptions = (
  question_type: string = ""
): Record<DraggingExerciseDropdownColumns, TableDropdownOption[]> => {
  const autoGradeOptions = useSelector(datasetSelectors.getAutoGradeOptions);
  const whichToGradeOptions = useSelector(datasetSelectors.getWhichToGradeOptions);

  return {
    autograde: autoGradeOptions.filter(
      (op) => !question_type || op.supported_question_types.includes(question_type)
    ),
    which_to_grade: whichToGradeOptions.filter(
      (op) => !question_type || op.supported_question_types.includes(question_type)
    )
  };
};
