import { ExercisePreviewModal } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreviewModal";
import { Column } from "primereact/column";
import { TreeTable } from "primereact/treetable";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { Exercise } from "@/types/exercises";

export const ChooseExercises = () => {
  const { availableExercises } = useExercisesSelector();

  return (
    <TreeTable
      style={{ height: "75vh" }}
      selectionMode="checkbox"
      selectionKeys={[]}
      onSelect={() => {}}
      onUnselect={() => {}}
      scrollable
      scrollHeight="50vh"
      value={availableExercises}
    >
      <Column field="title" header="Select exercises" expander></Column>
      <Column field="name" header="Name"></Column>
      <Column field="qnumber" header="Question number"></Column>
      <Column
        field="htmlsrc"
        header="Preview"
        body={({ data }: { data: Exercise }) => {
          if (!data?.htmlsrc) {
            return null;
          }

          return <ExercisePreviewModal htmlsrc={data.htmlsrc} />;
        }}
      ></Column>
      <Column field="question_type" header="Question type"></Column>
    </TreeTable>
  );
};
