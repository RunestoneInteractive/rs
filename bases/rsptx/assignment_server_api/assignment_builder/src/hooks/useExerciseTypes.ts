import { datasetSelectors } from "@store/dataset/dataset.logic";
import { useSelector } from "react-redux";

import { colorSchemes, exerciseDescriptions, ExerciseTypeConfig } from "@/config/exerciseTypes";

export const useExerciseTypes = (): ExerciseTypeConfig[] => {
  const questionTypeOptions = useSelector(datasetSelectors.getQuestionTypeOptions);

  return questionTypeOptions.map((option, index) => ({
    ...option,
    color: colorSchemes[index],
    tag: option.value,
    description: exerciseDescriptions[option.value]
  }));
};
