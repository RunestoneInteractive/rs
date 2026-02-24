import { useCallback, useState } from "react";

import { SearchInput } from "@components/ui/SearchInput";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import { DataTable, DataTableSortEvent } from "primereact/datatable";
import { InputSwitch } from "primereact/inputswitch";
import { classNames } from "primereact/utils";

import { Assignment } from "@/types/assignment";
import { formatLocalDateForDisplay, formatUTCDateForDisplay } from "@/utils/date";

import { VisibilityDropdown } from "./VisibilityDropdown";

// eslint-disable-next-line no-restricted-imports
import styles from "../../AssignmentBuilder.module.css";

interface AssignmentListProps {
  assignments: Assignment[];
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  onCreateNew: () => void;
  onEdit: (assignment: Assignment) => void;
  onDuplicate: (assignment: Assignment) => void;
  onReleasedChange: (assignment: Assignment, released: boolean) => void;
  onEnforceDueChange: (assignment: Assignment, enforce_due: boolean) => void;
  onVisibilityChange: (
    assignment: Assignment,
    data: { visible: boolean; visible_on: string | null; hidden_on: string | null }
  ) => void;
  onRemove: (assignment: Assignment) => void;
}

export const AssignmentList = ({
  assignments,
  globalFilter,
  setGlobalFilter,
  onCreateNew,
  onEdit,
  onDuplicate,
  onReleasedChange,
  onEnforceDueChange,
  onVisibilityChange,
  onRemove
}: AssignmentListProps) => {
  const SORT_STORAGE_KEY = "assignmentList_sortField";
  const ORDER_STORAGE_KEY = "assignmentList_sortOrder";

  const [sortField, setSortField] = useState<string>(() => {
    return localStorage.getItem(SORT_STORAGE_KEY) || "name";
  });
  const [sortOrder, setSortOrder] = useState<1 | -1 | 0>(() => {
    const stored = localStorage.getItem(ORDER_STORAGE_KEY);

    return stored ? (Number(stored) as 1 | -1) : 1;
  });

  const handleSort = useCallback((e: DataTableSortEvent) => {
    const field = (e.sortField as string) || "name";
    const order = e.sortOrder as 1 | -1;

    setSortField(field);
    setSortOrder(order);
    localStorage.setItem(SORT_STORAGE_KEY, field);
    localStorage.setItem(ORDER_STORAGE_KEY, String(order));
  }, []);

  const visibilityBodyTemplate = (rowData: Assignment) => (
    <VisibilityDropdown assignment={rowData} onChange={onVisibilityChange} />
  );

  const releasedBodyTemplate = (rowData: Assignment) => (
    <div className="flex align-items-center justify-content-center">
      <InputSwitch
        checked={rowData.released}
        onChange={(e) => onReleasedChange(rowData, e.value)}
        tooltip={rowData.released ? "Released to students" : "Not released to students"}
        tooltipOptions={{
          position: "top"
        }}
        className={styles.smallSwitch}
      />
    </div>
  );

  const enforceDueBodyTemplate = (rowData: Assignment) => (
    <div className="flex align-items-center justify-content-center">
      <InputSwitch
        checked={!rowData.enforce_due}
        onChange={(e) => onEnforceDueChange(rowData, !e.value)}
        tooltip={
          !rowData.enforce_due ? "Late submissions are allowed" : "Late submissions are not allowed"
        }
        tooltipOptions={{
          position: "top"
        }}
        className={styles.smallSwitch}
      />
    </div>
  );

  const nameBodyTemplate = (rowData: Assignment) => (
    <div className={styles.nameCell}>
      <span
        className={styles.nameText}
        style={{ cursor: "pointer", color: "#007ad9" }}
        onClick={() => onEdit(rowData)}
        title="Click to edit assignment"
      >
        {rowData.name}
      </span>
    </div>
  );

  const typeBodyTemplate = (rowData: Assignment) => (
    <div className={styles.typeCell}>
      <span
        className={classNames(styles.typeTag, styles[rowData.kind?.toLowerCase() || "default"])}
      >
        {rowData.kind || "Unknown"}
      </span>
    </div>
  );

  const dueDateBodyTemplate = (rowData: Assignment) => (
    <div className={styles.dueDateCell}>
      <span className={styles.dueDateText}>
        {formatLocalDateForDisplay(rowData.duedate, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })}
      </span>
    </div>
  );

  const updatedDateBodyTemplate = (rowData: Assignment) => (
    <div className={styles.dueDateCell}>
      <span className={styles.dueDateText}>
        {rowData.updated_date
          ? formatUTCDateForDisplay(rowData.updated_date, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })
          : ""}
      </span>
    </div>
  );

  const pointsBodyTemplate = (rowData: Assignment) => (
    <div className={styles.pointsCell}>
      <span className={styles.pointsText}>{rowData.points}</span>
    </div>
  );

  const actionsBodyTemplate = (rowData: Assignment) => (
    <div className="flex gap-1 justify-content-center">
      <Button
        icon="pi pi-pencil"
        onClick={() => onEdit(rowData)}
        className="p-button-text p-button-sm"
        tooltip="Edit"
        tooltipOptions={{
          position: "top"
        }}
      />
      <Button
        icon="pi pi-copy"
        onClick={() => onDuplicate(rowData)}
        className="p-button-text p-button-sm"
        tooltip="Duplicate"
        tooltipOptions={{
          position: "top"
        }}
      />
      <Button
        icon="pi pi-trash"
        className="p-button-text p-button-sm"
        tooltip="Delete"
        tooltipOptions={{
          position: "top"
        }}
        onClick={() => {
          confirmDialog({
            message: "Are you sure you want to delete assignment?",
            header: "Confirmation",
            icon: "pi pi-exclamation-triangle",
            accept: () => onRemove(rowData),
            reject: () => {}
          });
        }}
      />
    </div>
  );

  const previewBodyTemplate = (rowData: Assignment) => (
    <div className="flex justify-content-center">
      <Button
        icon="pi pi-eye"
        onClick={() => {
          const protocol = window.location.protocol;
          const hostname = window.location.hostname;
          const baseUrl = `${protocol}//${hostname}`;
          const previewUrl = `${baseUrl}/assignment/student/doAssignment?assignment_id=${rowData.id}`;

          window.open(previewUrl, "_blank");
        }}
        className="p-button-text p-button-sm"
        tooltip="Preview as student"
        tooltipOptions={{
          position: "top"
        }}
      />
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={classNames(styles.header, styles.tableHeader)}>
        <h1>Assignments</h1>
        <div className="flex gap-3 align-items-center">
          <SearchInput
            value={globalFilter}
            onChange={setGlobalFilter}
            placeholder="Search assignments"
            className="w-15rem"
          />
          <Button
            label="Create New Assignment"
            icon="pi pi-plus"
            onClick={onCreateNew}
            className="p-button-primary p-button-sm"
          />
        </div>
      </div>
      <ConfirmDialog />
      <DataTable
        value={assignments}
        className={styles.table}
        scrollable
        scrollHeight="calc(100vh - 200px)"
        globalFilter={globalFilter}
        globalFilterFields={["name"]}
        filterLocale="en"
        size="small"
        showGridlines={false}
        stripedRows
        emptyMessage="No assignments found"
        filterDisplay="menu"
        filters={{
          name: { value: globalFilter, matchMode: "contains" }
        }}
        sortMode="single"
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
      >
        <Column
          field="name"
          header="Name"
          sortable
          body={nameBodyTemplate}
          className={styles.nameColumn}
        />
        <Column
          field="kind"
          header="Type"
          sortable
          body={typeBodyTemplate}
          className={styles.typeColumn}
        />
        <Column
          field="duedate"
          header="Due Date"
          sortable
          body={dueDateBodyTemplate}
          className={styles.dueDateColumn}
        />
        <Column
          field="updated_date"
          header="Last Updated"
          sortable
          body={updatedDateBodyTemplate}
          className={styles.dueDateColumn}
        />
        <Column
          style={{ width: "12px" }}
          field="enforce_due"
          header={
            <div style={{ lineHeight: "1.2", textAlign: "center" }}>
              Allow Late
              <br />
              Submissions
            </div>
          }
          body={enforceDueBodyTemplate}
          className={styles.enforceDueColumn}
        />
        <Column
          field="points"
          header="Points"
          sortable
          body={pointsBodyTemplate}
          className={styles.pointsColumn}
        />
        <Column
          style={{ width: "150px", minWidth: "150px" }}
          field="visible"
          header="Visibility Status"
          body={visibilityBodyTemplate}
          className={styles.visibilityColumn}
        />
        <Column
          style={{ width: "12px" }}
          field="released"
          header="Released"
          body={releasedBodyTemplate}
          className={styles.releasedColumn}
        />
        <Column header="Preview" body={previewBodyTemplate} className={styles.previewColumn} />
        <Column body={actionsBodyTemplate} className={styles.actionsColumn} />
      </DataTable>
    </div>
  );
};
