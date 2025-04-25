import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { datasetSelectors } from "@store/dataset/dataset.logic";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useSelector } from "react-redux";

import { CreateExerciseFormType, Exercise, QuestionJSON } from "@/types/exercises";
import { safeJsonParse } from "@/utils/json";
import { buildQuestionJson, mergeQuestionJsonWithDefaults } from "@/utils/questionJson";

import { CreateExercise } from "../components/CreateExercise/CreateExercise";

import { SetCurrentEditExercise, ViewModeSetter } from "./types";

interface EditViewProps {
  currentEditExercise: Exercise | null;
  setCurrentEditExercise: SetCurrentEditExercise;
  setViewMode: ViewModeSetter;
  refetch?: () => void;
}

export const EditView = ({
  currentEditExercise,
  setCurrentEditExercise,
  setViewMode,
  refetch
}: EditViewProps) => {
  const [updateExercises] = useUpdateAssignmentQuestionsMutation();
  const languageOptions = useSelector(datasetSelectors.getLanguageOptions);
  const [isSaving, setIsSaving] = useState(false);

  if (!currentEditExercise) return null;

  const questionJson = safeJsonParse<QuestionJSON>(currentEditExercise.question_json);
  let initialData: CreateExerciseFormType = {
    ...currentEditExercise,
    ...mergeQuestionJsonWithDefaults(languageOptions, questionJson)
  };

  return (
    <CreateExercise
      initialData={initialData}
      onCancel={() => {
        setCurrentEditExercise(null);
        setViewMode("list");
      }}
      onSave={async (data: CreateExerciseFormType) => {
        setIsSaving(true);
        try {
          const response = await updateExercises([
            { ...data, question_json: buildQuestionJson(data) }
          ]);

          if (response.data) {
            toast.success("Exercise was successfully updated!");
            setViewMode("list");
            setIsSaving(false);
            setCurrentEditExercise(null);

            if (refetch) refetch();
          }
        } catch (error) {
          console.error("Error updating exercise:", error);
          toast.error("An error occurred while updating the exercise. Please try again.");
          setIsSaving(false);
        }
      }}
      isEdit={true}
    />
  );
};
