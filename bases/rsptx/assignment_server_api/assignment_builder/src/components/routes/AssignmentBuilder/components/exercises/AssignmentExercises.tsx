import { Loader } from "@components/ui/Loader";
import { exercisesActions, exercisesSelectors } from "@store/exercises/exercises.logic";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { useDispatch, useSelector } from "react-redux";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { Exercise } from "@/types/exercises";

import { AssignmentExercisesHeader } from "./AssignmentExercisesHeader";

export const AssignmentExercises = () => {
  const dispatch = useDispatch();
  const { loading, error, assignmentExercises, refetch } = useExercisesSelector();
  const selectedExercises = useSelector(exercisesSelectors.getSelectedExercises);

  const setSelectedExercises = (exercises: Exercise[]) => {
    dispatch(exercisesActions.setSelectedExercises(exercises));
  };

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div>
        <p>Error fetching exercises for the selected assignment.</p>
        <button onClick={refetch}>Refetch</button>
      </div>
    );
  }

  return (
    <DataTable
      style={{ minWidth: "100%" }}
      value={assignmentExercises}
      sortMode="single"
      sortField="chapter"
      sortOrder={1}
      scrollable
      scrollHeight="500px"
      size="small"
      stripedRows
      showGridlines
      header={<AssignmentExercisesHeader />}
      selection={selectedExercises}
      selectionMode="multiple"
      onSelectionChange={(e) => setSelectedExercises(e.value as unknown as Exercise[])}
    >
      <Column selectionMode="multiple"></Column>
      <Column field="qnumber" header="qnumber"></Column>
      <Column field="autograde" header="autograde"></Column>
      <Column field="which_to_grade" header="which_to_grade"></Column>
      <Column field="points" header="points"></Column>
    </DataTable>
  );
};
