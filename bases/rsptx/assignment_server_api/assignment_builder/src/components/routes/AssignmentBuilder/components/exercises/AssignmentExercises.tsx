import { EditDropdownValueHeader } from "@components/routes/AssignmentBuilder/components/exercises/components/EditAllExercises/EditDropdownValueHeader";
import { EditInputValueHeader } from "@components/routes/AssignmentBuilder/components/exercises/components/EditAllExercises/EditInputValueHeader";
import { ExercisePreviewModal } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreviewModal";
import { EditableCellFactory } from "@components/ui/EditableTable/EditableCellFactory";
import { TableSelectionOverlay } from "@components/ui/EditableTable/TableOverlay";
import { withDragLogic, WithDragLogicProps } from "@components/ui/EditableTable/hoc/withDragLogic";
import { Loader } from "@components/ui/Loader";
import { useReorderAssignmentExercisesMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { exercisesActions, exercisesSelectors } from "@store/exercises/exercises.logic";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { Exercise } from "@/types/exercises";

import { AssignmentExercisesHeader } from "./AssignmentExercisesHeader";

const AssignmentExercisesComponent = ({
  startRowIndex,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange
}: WithDragLogicProps) => {
  const dataTableRef = useRef<DataTable<Exercise[]>>(null);
  const dispatch = useDispatch();
  const [reorderExercises] = useReorderAssignmentExercisesMutation();
  const { loading, error, assignmentExercises = [], refetch } = useExercisesSelector();
  const selectedExercises = useSelector(exercisesSelectors.getSelectedExercises);

  const setSelectedExercises = (exercises: Exercise[]) => {
    if (startRowIndex === null) {
      dispatch(exercisesActions.setSelectedExercises(exercises));
    }
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
    <>
      <DataTable
        style={{ minWidth: "100%", userSelect: "none" }}
        value={assignmentExercises}
        ref={dataTableRef}
        scrollable
        scrollHeight="400px"
        size="small"
        stripedRows
        showGridlines
        header={<AssignmentExercisesHeader />}
        selection={selectedExercises}
        selectionMode="checkbox"
        onSelectionChange={(e) => setSelectedExercises(e.value as unknown as Exercise[])}
        reorderableRows
        onRowReorder={(e) => reorderExercises(e.value.map((exercise) => exercise.id))}
      >
        <Column selectionMode="multiple"></Column>
        {/*Temp disable edit column*/}
        {/*<Column*/}
        {/*  style={{ width: "3rem" }}*/}
        {/*  header="Edit"*/}
        {/*  body={(data: Exercise) => <EditExercise exercise={data} />}*/}
        {/*></Column>*/}
        <Column field="qnumber" header="qnumber"></Column>
        <Column
          style={{ width: "3rem" }}
          field="htmlsrc"
          header="Preview"
          body={(data: Exercise) => {
            if (!data?.htmlsrc) {
              return null;
            }

            return <ExercisePreviewModal htmlsrc={data.htmlsrc} />;
          }}
        ></Column>
        <Column field="question_type" header="Question Type"></Column>
        <Column
          style={{ width: "12rem" }}
          field="autograde"
          header={() => (
            <EditDropdownValueHeader field="autograde" label="Autograde" defaultValue="" />
          )}
          bodyStyle={{ padding: 0 }}
          body={(rowData: Exercise, { rowIndex }) => (
            <EditableCellFactory
              fieldName="autograde"
              rowIndex={rowIndex}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={rowData.autograde}
              questionType={rowData.question_type}
              isDragging={startRowIndex !== null}
            />
          )}
        ></Column>
        <Column
          field="which_to_grade"
          header={() => (
            <EditDropdownValueHeader
              field="which_to_grade"
              label="Which To Grade"
              defaultValue=""
            />
          )}
          style={{ width: "12rem" }}
          bodyStyle={{ padding: 0 }}
          body={(rowData: Exercise, { rowIndex }) => (
            <EditableCellFactory
              fieldName="which_to_grade"
              rowIndex={rowIndex}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={rowData.which_to_grade}
              questionType={rowData.question_type}
              isDragging={startRowIndex !== null}
            />
          )}
        ></Column>
        <Column
          style={{ width: "10rem" }}
          field="points"
          header={() => <EditInputValueHeader field="points" label="Points" defaultValue={0} />}
          bodyStyle={{ padding: 0 }}
          body={(rowData: Exercise, { rowIndex }) => (
            <EditableCellFactory
              fieldName="points"
              rowIndex={rowIndex}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={rowData.points}
              questionType={rowData.question_type}
              isDragging={startRowIndex !== null}
            />
          )}
        ></Column>
        <Column rowReorder style={{ width: "3rem" }} />
      </DataTable>
      <TableSelectionOverlay
        startRowIndex={startRowIndex}
        draggingFieldName={draggingFieldName}
        tableRef={dataTableRef.current!}
        handleMouseUp={handleMouseUp}
      />
    </>
  );
};

export const AssignmentExercises = withDragLogic(AssignmentExercisesComponent);
