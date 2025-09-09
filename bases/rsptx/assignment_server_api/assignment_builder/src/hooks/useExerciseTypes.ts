import { datasetSelectors } from "@store/dataset/dataset.logic";
import { useSelector } from "react-redux";

import { colorSchemes, ExerciseTypeConfig } from "@/config/exerciseTypes";

export const useExerciseTypes = (): ExerciseTypeConfig[] => {
  const questionTypeOptions = useSelector(datasetSelectors.getQuestionTypeOptions);
  const unsupportedTypes = ["webwork"];

  return questionTypeOptions
    .filter((questionTypeOption) => !unsupportedTypes.includes(questionTypeOption.value))
    .map((option, index) => ({
      ...option,
      color: colorSchemes[index],
      tag: option.value
    }));
};
