import { assignmentSelectors } from "@store/assignment/assignment.logic";
import { useCreateNewExerciseMutation } from "@store/exercises/exercises.logic.api";
import { useSelector } from "react-redux";

import { CreateExerciseFormType } from "@/types/exercises";
import { buildQuestionJson } from "@/utils/questionJson";

import { CreateExercise } from "../components/CreateExercise/CreateExercise";

import { ViewModeSetter } from "./types";

interface CreateViewProps {
  setViewMode: ViewModeSetter;
  resetExerciseForm: boolean;
  setResetExerciseForm: (reset: boolean) => void;
  setShowSuccessDialog: (show: boolean) => void;
  setLastExerciseType: (type: string) => void;
  setIsSaving: (saving: boolean) => void;
}

export const CreateView = ({
  setViewMode,
  resetExerciseForm,
  setResetExerciseForm,
  setShowSuccessDialog,
  setLastExerciseType,
  setIsSaving
}: CreateViewProps) => {
  const [createNewExercise] = useCreateNewExerciseMutation();
  const assignmentId = useSelector(assignmentSelectors.getSelectedAssignmentId);

  return (
    <CreateExercise
      onCancel={() => {
        setResetExerciseForm(false);
        setViewMode("list");
      }}
      onSave={async (data: CreateExerciseFormType) => {
        setIsSaving(true);

        try {
          await createNewExercise({
            author: data.author ?? "",
            autograde: null,
            chapter: data.chapter,
            subchapter: data.subchapter,
            difficulty: data.difficulty,
            htmlsrc: data.htmlsrc,
            name: data.name,
            question_json: buildQuestionJson(data),
            question_type: data.question_type,
            source: "This question was written in the web interface",
            tags: data.tags,
            topic: data.topic,
            points: data.points,
            is_reading: false,
            is_private: data.is_private ?? false,
            assignment_id: assignmentId!
          }).unwrap();

          setLastExerciseType(data.question_type);
          setShowSuccessDialog(true);
        } catch (error) {
          setIsSaving(false);
          throw error;
        }
      }}
      resetForm={resetExerciseForm}
      onFormReset={() => setResetExerciseForm(false)}
    />
  );
};
