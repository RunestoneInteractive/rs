import { AssignmentReadingsHeader } from "@components/routes/AssignmentBuilder/components/reading/AssignmentReadingsHeader";
import { Loader } from "@components/ui/Loader";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { useEffect, useState } from "react";

import { useReadingsSelector } from "@/hooks/useReadingsSelector";
import { Exercise } from "@/types/exercises";

export const AssignmentReadings = () => {
  const { loading, error, readingExercises, refetch } = useReadingsSelector();
  const [selectedReadings, setSelectedReadings] = useState<Exercise[]>([]);

  useEffect(() => {
    setSelectedReadings((oldState) =>
      oldState.filter((r) => readingExercises?.map((e) => e.id).includes(r.id))
    );
  }, [readingExercises]);

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div>
        <p>Error fetching questions for the selected assignment.</p>
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
      header={
        <AssignmentReadingsHeader
          selectedReadings={selectedReadings}
          setSelectedReadings={setSelectedReadings}
        />
      }
      selection={selectedReadings}
      selectionMode="multiple"
      onSelectionChange={(e) => setSelectedReadings(e.value as unknown as Exercise[])}
    >
      <Column selectionMode="multiple"></Column>
      <Column field="chapter" header="Chapter"></Column>
      <Column field="subchapter" header="Subchapter"></Column>
      <Column field="numQuestions" header="Number of questions"></Column>
      <Column
        field="activities_required"
        header="Required"
        body={(data: Exercise) => (data.activities_required ? "Yes" : "No")}
      ></Column>
      <Column field="points" header="Points"></Column>
    </DataTable>
  );
};
