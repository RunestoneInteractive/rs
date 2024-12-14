import { ExercisePreviewModal } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreviewModal";
import { Column } from "primereact/column";
import { TreeTable } from "primereact/treetable";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { Exercise } from "@/types/exercises";

export const ChooseExercises = () => {
  const { availableExercises, selectedKeys, addExercises, removeExercisesFromAvailableExercises } =
    useExercisesSelector();

  return (
    <TreeTable
      selectionMode="checkbox"
      selectionKeys={selectedKeys}
      onSelect={addExercises}
      onUnselect={removeExercisesFromAvailableExercises}
      scrollable
      value={availableExercises}
      resizableColumns
    >
      <Column
        style={{ width: "35%" }}
        field="title"
        header="Select exercises"
        expander
        bodyClassName={(_, options) => {
          return options.props.node.disabled ? "treetable-no-checkbox" : "";
        }}
      ></Column>
      <Column style={{ width: "20%" }} field="name" header="Name"></Column>
      <Column style={{ width: "15%" }} field="qnumber" header="Question number"></Column>
      <Column
        style={{ width: "15%" }}
        field="htmlsrc"
        header="Preview"
        body={({ data }: { data: Exercise }) => {
          if (!data?.htmlsrc) {
            return null;
          }

          return <ExercisePreviewModal htmlsrc={data.htmlsrc} />;
        }}
      ></Column>
      <Column style={{ width: "15%" }} field="question_type" header="Question type"></Column>
    </TreeTable>
  );
};
