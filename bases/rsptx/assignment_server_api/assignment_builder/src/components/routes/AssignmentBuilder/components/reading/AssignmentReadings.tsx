import { AssignmentReadingsHeader } from "@components/routes/AssignmentBuilder/components/reading/AssignmentReadingsHeader";
import { Loader } from "@components/ui/Loader";
import { readingsActions, readingsSelectors } from "@store/readings/readings.logic";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { useDispatch, useSelector } from "react-redux";

import { useReadingsSelector } from "@/hooks/useReadingsSelector";
import { Exercise } from "@/types/exercises";

export const AssignmentReadings = () => {
  const dispatch = useDispatch();
  const { loading, error, readingExercises, refetch } = useReadingsSelector();
  const selectedReadings = useSelector(readingsSelectors.getSelectedReadings);

  const setSelectedReadings = (readings: Exercise[]) => {
    dispatch(readingsActions.setSelectedReadings(readings));
  };

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div>
        <p>Error fetching readings for the selected assignment.</p>
        <button onClick={refetch}>Refetch</button>
      </div>
    );
  }

  return (
    <DataTable
      style={{ minWidth: "100%" }}
      value={readingExercises}
      sortMode="single"
      sortField="chapter"
      sortOrder={1}
      scrollable
      scrollHeight="500px"
      size="small"
      stripedRows
      showGridlines
      header={<AssignmentReadingsHeader />}
      selection={selectedReadings}
      selectionMode="multiple"
      onSelectionChange={(e) => setSelectedReadings(e.value as unknown as Exercise[])}
    >
      <Column selectionMode="multiple"></Column>
      <Column field="chapter" header="Chapter"></Column>
      <Column field="subchapter" header="Subchapter"></Column>
      <Column field="numQuestions" header="Number of questions"></Column>
      <Column field="activities_required" header="Required"></Column>
      <Column field="points" header="Points"></Column>
    </DataTable>
  );
};
