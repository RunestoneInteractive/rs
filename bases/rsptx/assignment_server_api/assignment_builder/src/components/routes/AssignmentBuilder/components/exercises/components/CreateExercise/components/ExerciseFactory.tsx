import { FC } from "react";

import { ExerciseComponentProps } from "../types/ExerciseTypes";

import {
  ParsonsExercise,
  ActiveCodeExercise,
  FillInTheBlankExercise,
  DragAndDropExercise,
  ClickableAreaExercise,
  PollExercise,
  ShortAnswerExercise,
  MultiChoiceExercise,
  MatchingExercise
} from ".";

export const ExerciseFactory: FC<ExerciseComponentProps> = (props) => {
  switch (props.type) {
    case "mchoice":
      return <MultiChoiceExercise {...props} />;
    case "parsonsprob":
      return <ParsonsExercise {...props} />;
    case "activecode":
      return <ActiveCodeExercise {...props} />;
    case "fillintheblank":
      return <FillInTheBlankExercise {...props} />;
    case "dragndrop":
      return <DragAndDropExercise {...props} />;
    case "clickablearea":
      return <ClickableAreaExercise {...props} />;
    case "poll":
      return <PollExercise {...props} />;
    case "shortanswer":
      return <ShortAnswerExercise {...props} />;
    case "matching":
      return <MatchingExercise {...props} />;
    default:
      throw new Error(`Unknown exercise type: ${props.type}`);
  }
};
