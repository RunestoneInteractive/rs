import { EditableCellFactory } from "@components/ui/EditableTable/EditableCellFactory";
import { TableSelectionOverlay } from "@components/ui/EditableTable/TableOverlay";
import { useReorderAssignmentExercisesMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { Column } from "primereact/column";
import { DataTable, DataTableSelectionMultipleChangeEvent } from "primereact/datatable";
import { useRef } from "react";

import { Nullable } from "@/types/common";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

import { ActivitiesRequiredCell } from "./components/ActivitiesRequiredCell";
import { EditDropdownValueHeaderReadings } from "./components/EditAllReadings/EditDropdownValueHeaderReadings";
import { EditInputValueHeaderReadings } from "./components/EditAllReadings/EditInputValueHeaderReadings";
import { SetCurrentEditReading, MouseUpHandler } from "./types";

interface AssignmentReadingsTableProps {
  assignmentReadings: Exercise[];
  selectedReadings: Exercise[];
  setSelectedReadings: (readings: Exercise[]) => void;
  globalFilter: string;
  setCurrentEditReading: SetCurrentEditReading;
  setViewMode: () => void;
  startItemId: number | null;
  draggingFieldName: DraggingExerciseColumns | null;
  handleMouseDown: (itemId: number, fieldName: DraggingExerciseColumns) => void;
  handleMouseUp: MouseUpHandler;
  handleChange: (itemId: number, fieldName: DraggingExerciseColumns, value: any) => void;
}

export const AssignmentReadingsTable = ({
  assignmentReadings,
  selectedReadings,
  setSelectedReadings,
  globalFilter,
  startItemId,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange
}: AssignmentReadingsTableProps) => {
  const dataTableRef = useRef<DataTable<Exercise[]>>(null);
  const [reorderReadings] = useReorderAssignmentExercisesMutation();

  const handleActivitiesRequiredUpdate = (itemId: number, fieldName: string, value: number) => {
    handleChange(itemId, fieldName as DraggingExerciseColumns, value);
  };

  const getNumQuestionsOrDefault = (numQuestions: Nullable<number>): number => {
    const defaultNumQuestions = 1;

    return numQuestions ?? defaultNumQuestions;
  };

  return (
    <div style={{ position: "relative", overflowX: "auto" }}>
      <DataTable<Exercise[]>
        style={{ minWidth: "100%", userSelect: "none" }}
        value={assignmentReadings}
        ref={dataTableRef}
        selection={selectedReadings}
        selectionMode="checkbox"
        onSelectionChange={(e: DataTableSelectionMultipleChangeEvent<Exercise[]>) =>
          setSelectedReadings(e.value)
        }
        dataKey="id"
        scrollable
        scrollHeight="calc(100vh - 320px)"
        size="small"
        rowClassName={() => "assignmentExercise_row"}
        stripedRows
        showGridlines
        globalFilter={globalFilter}
        globalFilterFields={["name", "title", "chapter", "subchapter"]}
        emptyMessage={
          <div className="text-center p-5">
            <i className="pi pi-book text-4xl text-500 mb-3" style={{ display: "block" }} />
            <p className="text-700 mb-2">No readings added</p>
            <p className="text-500 text-sm">Click "Choose readings" to get started</p>
          </div>
        }
        reorderableRows
        onRowReorder={(e) => reorderReadings(e.value.map((reading) => reading.id))}
      >
        <Column selectionMode="multiple" style={{ width: "3rem" }} />

        {/* Chapter */}
        <Column
          field="chapter"
          header="Chapter"
          style={{
            maxWidth: "12rem"
          }}
          body={(data: Exercise) => (
            <div>
              <div className="font-medium nowrap">{data.chapter}</div>
            </div>
          )}
          sortable
        />

        {/* Subchapter */}
        <Column
          field="subchapter"
          header="Subchapter"
          style={{ maxWidth: "30rem" }}
          body={(data: Exercise) => (
            <div>
              <div className="font-medium nowrap">{data.name || data.title}</div>
              <div className="text-500 text-sm nowrap">{data.subchapter}</div>
            </div>
          )}
          sortable
        />

        {/* Activity count (read-only) */}
        <Column
          field="numQuestions"
          header="Activity count"
          style={{ maxWidth: "7rem" }}
          body={(data: Exercise) => (
            <div className="text-center">{getNumQuestionsOrDefault(data.numQuestions)}</div>
          )}
          sortable
        />

        {/* # required (editable, no bulk edit) */}
        <Column
          field="activities_required"
          header="# required"
          style={{ maxWidth: "7rem" }}
          bodyStyle={{ padding: 0 }}
          body={(data: Exercise) => (
            <ActivitiesRequiredCell
              value={
                data.activities_required ||
                Math.round(getNumQuestionsOrDefault(data.numQuestions) * 0.8)
              }
              exercise={data}
              onUpdate={handleActivitiesRequiredUpdate}
              itemId={data.id}
            />
          )}
        />

        {/* Points */}
        <Column
          field="points"
          bodyStyle={{ padding: 0 }}
          style={{ maxWidth: "7rem" }}
          header={() => (
            <EditInputValueHeaderReadings field="points" label="Points" defaultValue={0} />
          )}
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

        {/* Which to grade */}
        <Column
          field="which_to_grade"
          header={() => (
            <EditDropdownValueHeaderReadings
              field="which_to_grade"
              label="Which to grade"
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

        <Column rowReorder style={{ width: "3rem" }} />
      </DataTable>
      <TableSelectionOverlay
        startItemId={startItemId}
        draggingFieldName={draggingFieldName}
        tableRef={dataTableRef.current!}
        handleMouseUp={handleMouseUp}
        type="readings"
        exercises={assignmentReadings}
      />
    </div>
  );
};
