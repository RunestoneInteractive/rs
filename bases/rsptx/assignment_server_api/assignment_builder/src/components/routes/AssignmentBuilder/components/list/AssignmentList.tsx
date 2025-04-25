import { SearchInput } from "@components/ui/SearchInput";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputSwitch } from "primereact/inputswitch";
import { classNames } from "primereact/utils";

import { Assignment } from "@/types/assignment";

// eslint-disable-next-line no-restricted-imports
import styles from "../../AssignmentBuilder.module.css";

interface AssignmentListProps {
  assignments: Assignment[];
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  onCreateNew: () => void;
  onEdit: (assignment: Assignment) => void;
  onDuplicate: (assignment: Assignment) => void;
  onVisibilityChange: (assignment: Assignment, visible: boolean) => void;
}

export const AssignmentList = ({
  assignments,
  globalFilter,
  setGlobalFilter,
  onCreateNew,
  onEdit,
  onDuplicate,
  onVisibilityChange
}: AssignmentListProps) => {
  const generateUniqueCopyName = (originalName: string): string => {
    const baseNameMatch = originalName.match(/(.*?)(?:\s*\(Copy\s*(\d+)?\))?$/);

    if (!baseNameMatch) return `${originalName} (Copy)`;
    const baseName = baseNameMatch[1];
    let copyNumber = baseNameMatch[2] ? parseInt(baseNameMatch[2]) : 1;
    const existingNames = new Set(assignments.map((a) => a.name));
    let newName = `${baseName} (Copy)`;

    while (existingNames.has(newName)) {
      copyNumber++;
      newName = `${baseName} (Copy ${copyNumber})`;
    }
    return newName;
  };

  const visibilityBodyTemplate = (rowData: Assignment) => (
    <div className="flex align-items-center justify-content-center">
      <InputSwitch
        checked={rowData.visible}
        onChange={(e) => onVisibilityChange(rowData, e.value)}
        tooltip={rowData.visible ? "Visible to students" : "Hidden from students"}
        tooltipOptions={{
          position: "top"
        }}
        className={styles.smallSwitch}
      />
    </div>
  );

  const nameBodyTemplate = (rowData: Assignment) => (
    <div className={styles.nameCell}>
      <span className={styles.nameText}>{rowData.name}</span>
    </div>
  );

  const typeBodyTemplate = (rowData: Assignment) => (
    <div className={styles.typeCell}>
      <span className={classNames(styles.typeTag, styles[rowData.kind.toLowerCase()])}>
        {rowData.kind}
      </span>
    </div>
  );

  const dueDateBodyTemplate = (rowData: Assignment) => (
    <div className={styles.dueDateCell}>
      <span className={styles.dueDateText}>
        {new Date(rowData.duedate).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        })}
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
        onClick={() => {
          const copy = {
            ...rowData,
            name: generateUniqueCopyName(rowData.name),
            id: 0
          };

          onDuplicate(copy);
        }}
        className="p-button-text p-button-sm"
        tooltip="Duplicate"
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
          field="points"
          header="Points"
          sortable
          body={pointsBodyTemplate}
          className={styles.pointsColumn}
        />
        <Column
          field="visible"
          header="Visible"
          body={visibilityBodyTemplate}
          className={styles.visibilityColumn}
        />
        <Column body={actionsBodyTemplate} className={styles.actionsColumn} />
      </DataTable>
    </div>
  );
};
