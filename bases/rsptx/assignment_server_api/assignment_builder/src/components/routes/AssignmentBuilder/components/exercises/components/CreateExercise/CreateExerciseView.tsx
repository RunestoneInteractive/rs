import { JSX } from "react";

import { CreateExerciseFormProps } from "@/types/createExerciseForm";
import { ExerciseType } from "@/types/exercises";

import { CreateActiveCodeExercise } from "./CreateActiveCodeExercise";
import { CreateMultipleChoiceExercise } from "./CreateMultipleChoiceExercise";
import { CreateShortAnswerExercise } from "./CreateShortAnswerExercise";

export const CreateExerciseView = ({
  mode,
  ...restProps
}: {
  mode: ExerciseType;
} & CreateExerciseFormProps) => {
  const config: Record<ExerciseType, JSX.Element> = {
    activecode: <CreateActiveCodeExercise {...restProps} />,
    mchoice: <CreateMultipleChoiceExercise {...restProps} />,
    shortanswer: <CreateShortAnswerExercise {...restProps} />
  };

  return config[mode];
};
