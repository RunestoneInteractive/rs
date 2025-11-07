import { EditableCellFactory } from "@components/ui/EditableTable/EditableCellFactory";
import { TableSelectionOverlay } from "@components/ui/EditableTable/TableOverlay";
import { ExerciseTypeTag } from "@components/ui/ExerciseTypeTag";
import { useReorderAssignmentExercisesMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { Column } from "primereact/column";
import { DataTable, DataTableSelectionMultipleChangeEvent } from "primereact/datatable";
import { Tooltip } from "primereact/tooltip";
import { useRef, useState } from "react";

import { difficultyOptions } from "@/config/exerciseTypes";
import { useJwtUser } from "@/hooks/useJwtUser";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise, supportedExerciseTypesToEdit } from "@/types/exercises";

import { CopyExerciseModal } from "../components/CopyExercise/CopyExerciseModal";
import { EditDropdownValueHeader } from "../components/EditAllExercises/EditDropdownValueHeader";
import { EditInputValueHeader } from "../components/EditAllExercises/EditInputValueHeader";
import { ExercisePreviewModal } from "../components/ExercisePreview/ExercisePreviewModal";

import { SetCurrentEditExercise, ViewModeSetter, MouseUpHandler } from "./types";

interface AssignmentExercisesTableProps {
  assignmentExercises: Exercise[];
  selectedExercises: Exercise[];
  setSelectedExercises: (exercises: Exercise[]) => void;
  globalFilter: string;
  setCurrentEditExercise: SetCurrentEditExercise;
  setViewMode: ViewModeSetter;
  startItemId: number | null;
  draggingFieldName: DraggingExerciseColumns | null;
  handleMouseDown: (itemId: number, fieldName: DraggingExerciseColumns) => void;
  handleMouseUp: MouseUpHandler;
  handleChange: (itemId: number, fieldName: DraggingExerciseColumns, value: any) => void;
}

export const AssignmentExercisesTable = ({
  assignmentExercises,
  selectedExercises,
  setSelectedExercises,
  globalFilter,
  setCurrentEditExercise,
  setViewMode,
  startItemId,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange
}: AssignmentExercisesTableProps) => {
  const { username } = useJwtUser();
  const [reorderExercises] = useReorderAssignmentExercisesMutation();
  const dataTableRef = useRef<DataTable<Exercise[]>>(null);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [selectedExerciseForCopy, setSelectedExerciseForCopy] = useState<Exercise | null>(null);

  const getExerciseTypeTag = (type: string) => {
    if (!type) return null;
    return <ExerciseTypeTag type={type} />;
  };

  const getIsEditable = (exercise: Exercise) => {
    return (
      exercise.owner === username &&
      supportedExerciseTypesToEdit.includes(exercise.question_type) &&
      !!exercise.question_json
    );
  };

  const getIsCopyable = (exercise: Exercise) => {
    return !!exercise.question_json;
  };

  const handleCopyClick = (exercise: Exercise) => {
    setSelectedExerciseForCopy(exercise);
    setCopyModalVisible(true);
  };

  const handleCopyModalHide = () => {
    setCopyModalVisible(false);
    setSelectedExerciseForCopy(null);
  };

  const getTooltipText = (data: Exercise) => {
    return Object.entries({
      Author: data.author,
      Difficulty: difficultyOptions[data.difficulty as keyof typeof difficultyOptions],
      Tags: data.tags,
      Chapter: data.chapter
    })
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
  };

  return (
    <div style={{ position: "relative", overflow: "auto" }}>
      <DataTable<Exercise[]>
        style={{ minWidth: "100%", userSelect: "none" }}
        value={assignmentExercises}
        ref={dataTableRef}
        selection={selectedExercises}
        selectionMode="checkbox"
        onSelectionChange={(e: DataTableSelectionMultipleChangeEvent<Exercise[]>) =>
          setSelectedExercises(e.value)
        }
        dataKey="id"
        scrollable
        scrollHeight="calc(100vh - 280px)"
        size="small"
        rowClassName={() => "assignmentExercise_row"}
        stripedRows
        showGridlines
        globalFilter={globalFilter}
        globalFilterFields={["name", "title", "qnumber"]}
        emptyMessage={
          <div className="text-center p-5">
            <i className="pi pi-book text-4xl text-500 mb-3" style={{ display: "block" }} />
            <p className="text-700 mb-2">No exercises added</p>
            <p className="text-500 text-sm">Click "Add Exercise" to get started</p>
          </div>
        }
        reorderableRows
        onRowReorder={(e) => reorderExercises(e.value.map((exercise) => exercise.id))}
        resizableColumns
        columnResizeMode="fit"
      >
        <Column resizeable={false} selectionMode="multiple" style={{ width: "3rem" }} />
        <Column
          resizeable={false}
          style={{ width: "2rem" }}
          body={(data: Exercise) => (
            <div className="flex gap-2 justify-content-center">
              <Tooltip target={`#info-icon-${data.id}`} content={getTooltipText(data)} />
              <i
                className="pi pi-info-circle"
                id={`info-icon-${data.id}`}
                style={{ cursor: "pointer" }}
              />
            </div>
          )}
        />
        <Column
          resizeable={false}
          style={{ width: "3rem" }}
          body={(data: Exercise) => (
            <div className="flex gap-2 justify-content-center">
              {data.htmlsrc && (
                <ExercisePreviewModal
                  htmlsrc={data.htmlsrc}
                  triggerButton={<i className="pi pi-eye" style={{ cursor: "pointer" }} />}
                />
              )}
            </div>
          )}
        />
        <Column
          resizeable={false}
          style={{ width: "3rem" }}
          body={(data: Exercise) => (
            <div className="flex gap-2 justify-content-center">
              {getIsEditable(data) && (
                <i
                  className="pi pi-pencil"
                  style={{
                    cursor: "pointer"
                  }}
                  onClick={() => {
                    setCurrentEditExercise(data);
                    setViewMode("edit");
                  }}
                />
              )}
            </div>
          )}
        />
        <Column
          resizeable={false}
          style={{ width: "3rem" }}
          body={(data: Exercise) => (
            <div className="flex gap-2 justify-content-center">
              {getIsCopyable(data) && (
                <i
                  className="pi pi-copy"
                  style={{
                    cursor: "pointer"
                  }}
                  onClick={() => handleCopyClick(data)}
                  title="Copy exercise"
                />
              )}
            </div>
          )}
        />
        <Column
          header="Exercise"
          bodyStyle={{
            maxWidth: "20rem"
          }}
          body={(data: Exercise) => (
            <div
              style={{
                maxWidth: "100%"
              }}
            >
              <div className="font-medium nowrap">{data.name || data.title}</div>
              <div className="text-500 text-sm nowrap">{data.qnumber}</div>
            </div>
          )}
          resizeable
        />
        <Column
          resizeable={false}
          field="question_type"
          header="Type"
          body={(data: Exercise) => getExerciseTypeTag(data.question_type)}
          style={{ width: "12rem" }}
        />
        <Column
          resizeable={false}
          style={{ width: "12rem" }}
          field="autograde"
          header={() => (
            <EditDropdownValueHeader field="autograde" label="Autograde" defaultValue="" />
          )}
          bodyStyle={{ padding: 0 }}
          body={(rowData: Exercise) => (
            <EditableCellFactory
              fieldName="autograde"
              itemId={rowData.id}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={rowData.autograde}
              questionType={rowData.question_type}
              isDragging={startItemId !== null}
            />
          )}
        />
        <Column
          resizeable={false}
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
          body={(rowData: Exercise) => (
            <EditableCellFactory
              fieldName="which_to_grade"
              itemId={rowData.id}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={rowData.which_to_grade}
              questionType={rowData.question_type}
              isDragging={startItemId !== null}
            />
          )}
        />
        <Column
          resizeable={false}
          field="points"
          bodyStyle={{ padding: 0 }}
          style={{ width: "8rem" }}
          header={() => <EditInputValueHeader field="points" label="Points" defaultValue={0} />}
          body={(data: Exercise) => (
            <EditableCellFactory
              fieldName="points"
              itemId={data.id}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={data.points}
              questionType={data.question_type}
              isDragging={startItemId !== null}
            />
          )}
        />
        <Column resizeable={false} rowReorder style={{ width: "3rem" }} />
      </DataTable>
      <TableSelectionOverlay
        startItemId={startItemId}
        draggingFieldName={draggingFieldName}
        tableRef={dataTableRef.current!}
        handleMouseUp={handleMouseUp}
        type="exercises"
        exercises={assignmentExercises}
      />

      <CopyExerciseModal
        visible={copyModalVisible}
        onHide={handleCopyModalHide}
        exercise={selectedExerciseForCopy}
        copyToAssignment={true}
        setCurrentEditExercise={setCurrentEditExercise}
        setViewMode={setViewMode}
      />
    </div>
  );
};
