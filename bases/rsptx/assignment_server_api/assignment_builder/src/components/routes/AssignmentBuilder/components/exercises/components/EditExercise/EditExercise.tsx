import { CreateExercise } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/CreateExercise";
import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { datasetSelectors } from "@store/dataset/dataset.logic";
import { Dialog } from "primereact/dialog";
import { MouseEvent, useState } from "react";
import { useSelector } from "react-redux";

import { CreateExerciseFormType, Exercise, QuestionJSON } from "@/types/exercises";
import { safeJsonParse } from "@/utils/json";
import { buildQuestionJson, mergeQuestionJsonWithDefaults } from "@/utils/questionJson";

export const EditExercise = ({ exercise }: { exercise: Exercise }) => {
  const [updateExercises] = useUpdateAssignmentQuestionsMutation();
  const languageOptions = useSelector(datasetSelectors.getLanguageOptions);
  const [showModal, setShowModal] = useState(false);

  const handleIconClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setShowModal(true);
  };

  const questionJson = safeJsonParse<QuestionJSON>(exercise.question_json);
  const initialValues = {
    ...exercise,
    ...mergeQuestionJsonWithDefaults(languageOptions, questionJson)
  };

  const onSubmit = async (data: CreateExerciseFormType) => {
    await updateExercises([{ ...data, question_json: buildQuestionJson(data) }]);
    setShowModal(false);
  };

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      className="flex align-center justify-content-center"
    >
      <i className="pi pi-pencil" onClick={handleIconClick} style={{ cursor: "pointer" }} />
      <Dialog
        visible={showModal}
        modal
        contentStyle={{
          display: "flex",
          alignItems: "start",
          justifyContent: "center"
        }}
        onHide={() => setShowModal(false)}
        header="Edit Exercise"
        style={{ width: "90vw" }}
        headerStyle={{ padding: "1rem 2rem" }}
        maximizable
      >
        <CreateExercise onFormSubmit={onSubmit} initialValues={initialValues} />
      </Dialog>
    </div>
  );
};
