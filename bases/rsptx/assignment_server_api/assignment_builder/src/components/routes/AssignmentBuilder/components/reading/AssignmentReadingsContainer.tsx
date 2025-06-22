import styles from "@components/routes/AssignmentBuilder/AssignmentBuilder.module.css";
import { Loader } from "@components/ui/Loader";
import { readingsActions, readingsSelectors } from "@store/readings/readings.logic";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useReadingsSelector } from "@/hooks/useReadingsSelector";
import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";
import { Exercise } from "@/types/exercises";

import { ReadingsListView } from "./ReadingsListView";
import { AssignmentReadingsComponentProps } from "./types";

export const AssignmentReadingsContainer = ({
  startItemId,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange
}: AssignmentReadingsComponentProps) => {
  const dispatch = useDispatch();
  const { loading, error, readingExercises = [], refetch } = useReadingsSelector();
  const selectedReadings = useSelector(readingsSelectors.getSelectedReadings);
  const [globalFilter, setGlobalFilter] = useState("");
  const { updateAssignmentExercises } = useUpdateAssignmentExercise();
  const [_, setCurrentEditReading] = useState<Exercise | null>(null);

  const setSelectedReadings = (readings: Exercise[]) => {
    if (startItemId === null) {
      dispatch(readingsActions.setSelectedReadings(readings));
    }
  };

  const handleRemoveSelected = async () => {
    if (!selectedReadings.length) return;

    await updateAssignmentExercises({
      idsToRemove: selectedReadings.map((x) => x.id).filter((id): id is number => id !== undefined),
      isReading: true
    });
    setSelectedReadings([]);
  };

  if (loading) return <Loader />;

  if (error) {
    return (
      <div>
        <p>Error fetching readings for the selected assignment.</p>
        <button onClick={refetch}>Refetch</button>
      </div>
    );
  }

  return (
    <div className={styles.readingManager}>
      <ReadingsListView
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        selectedReadings={selectedReadings}
        setSelectedReadings={setSelectedReadings}
        handleRemoveSelected={handleRemoveSelected}
        assignmentReadings={readingExercises}
        setCurrentEditReading={setCurrentEditReading}
        startItemId={startItemId}
        draggingFieldName={draggingFieldName}
        handleMouseDown={handleMouseDown}
        handleMouseUp={handleMouseUp}
        handleChange={handleChange}
      />
    </div>
  );
};
