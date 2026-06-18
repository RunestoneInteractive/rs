import { datasetSelectors } from "@store/dataset/dataset.logic";
import { useSelector } from "react-redux";

import {
  ExerciseTypeConfig,
  getExerciseColorScheme,
  getExerciseTypeLabel
} from "@/config/exerciseTypes";

export const useExerciseTypes = (): ExerciseTypeConfig[] => {
  const questionTypeOptions = useSelector(datasetSelectors.getQuestionTypeOptions);
  const unsupportedTypes = ["webwork"];

  return questionTypeOptions
    .filter((questionTypeOption) => !unsupportedTypes.includes(questionTypeOption.value))
    .map((option) => ({
      ...option,
      label: getExerciseTypeLabel(option.value, option.label),
      color: getExerciseColorScheme(option.value),
      tag: option.value
    }));
};
