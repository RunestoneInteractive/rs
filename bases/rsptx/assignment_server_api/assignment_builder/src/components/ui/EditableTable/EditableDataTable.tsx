import { Checkbox, Table, VisuallyHidden } from "@mantine/core";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import classNames from "classnames";
import { ReactNode, RefCallback, useMemo } from "react";

import { DraggingExerciseColumns } from "@/types/components/editableTableCell";

import { Icon } from "../Icon";

import styles from "./EditableDataTable.module.css";

export interface EditableColumn<T> {
  key: string;
  header: ReactNode;
  hiddenHeaderLabel?: string;
  width?: number | string;
  field?: DraggingExerciseColumns;
  align?: "left" | "center" | "right";
  flushCell?: boolean;
  render: (row: T) => ReactNode;
}

interface RowEntity {
  id: number;
}

interface EditableDataTableProps<T extends RowEntity> {
  data: T[];
  columns: EditableColumn<T>[];
  selection: T[];
  onSelectionChange: (rows: T[]) => void;
  onReorder: (orderedIds: number[]) => void;
  emptyMessage: ReactNode;
  ariaLabel?: string;
  containerRef?: (element: HTMLDivElement | null) => void;
  scrollSentinelRef?: RefCallback<HTMLElement>;
  flush?: boolean;
  children?: ReactNode;
  getRowLabel?: (row: T) => string;
}

interface EditableRowProps<T extends RowEntity> {
  row: T;
  columns: EditableColumn<T>[];
  selected: boolean;
  onToggle: (row: T) => void;
  rowLabel: string;
}

const SETTLE_DURATION_MS = 200;

const EditableRow = <T extends RowEntity>({
  row,
  columns,
  selected,
  onToggle,
  rowLabel
}: EditableRowProps<T>) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    transition: { duration: SETTLE_DURATION_MS, easing: "var(--rs-spring-snappy)" }
  });

  const baseTransform = CSS.Transform.toString(transform);

  return (
    <Table.Tr
      ref={setNodeRef}
      data-item-id={row.id}
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      style={{
        transform: isDragging && baseTransform ? `${baseTransform} scale(0.98)` : baseTransform,
        transition,
        zIndex: isDragging ? 1 : undefined,
        position: isDragging ? "relative" : undefined
      }}
    >
      <Table.Td className={styles.controlCell}>
        <Checkbox
          size="sm"
          checked={selected}
          onChange={() => onToggle(row)}
          aria-label={`Select ${rowLabel}`}
        />
      </Table.Td>
      {columns.map((col) => (
        <Table.Td
          key={col.key}
          data-field={col.field}
          data-flush-cell={col.flushCell || undefined}
          className={col.flushCell ? styles.flushTd : undefined}
          style={{ width: col.width, textAlign: col.align ?? "left" }}
        >
          {col.render(row)}
        </Table.Td>
      ))}
      <Table.Td className={styles.controlCell}>
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={`Reorder ${rowLabel}`}
          {...attributes}
          {...listeners}
        >
          <Icon name="bars" size={16} />
        </button>
      </Table.Td>
    </Table.Tr>
  );
};

export const EditableDataTable = <T extends RowEntity>({
  data,
  columns,
  selection,
  onSelectionChange,
  onReorder,
  emptyMessage,
  ariaLabel,
  containerRef,
  scrollSentinelRef,
  flush = false,
  children,
  getRowLabel
}: EditableDataTableProps<T>) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedIds = useMemo(() => new Set(selection.map((row) => row.id)), [selection]);
  const allSelected = data.length > 0 && data.every((row) => selectedIds.has(row.id));
  const someSelected = data.some((row) => selectedIds.has(row.id));

  const toggleRow = (row: T) => {
    if (selectedIds.has(row.id)) {
      onSelectionChange(selection.filter((item) => item.id !== row.id));
    } else {
      onSelectionChange([...selection, row]);
    }
  };

  const toggleAll = () => {
    onSelectionChange(allSelected ? [] : [...data]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }
    const fromIndex = data.findIndex((row) => row.id === active.id);
    const toIndex = data.findIndex((row) => row.id === over.id);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    onReorder(arrayMove(data, fromIndex, toIndex).map((row) => row.id));
  };

  const rowIds = useMemo(() => data.map((row) => row.id), [data]);
  const columnCount = columns.length + 2;

  return (
    <div
      className={classNames(styles.wrap, { [styles.wrapFlush]: flush })}
      data-flush={flush || undefined}
      ref={containerRef}
    >
      {scrollSentinelRef && (
        <div ref={scrollSentinelRef} className={styles.scrollSentinel} data-scroll-sentinel="" />
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <Table stickyHeader verticalSpacing="xs" aria-label={ariaLabel}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className={styles.controlCell}>
                <Checkbox
                  size="sm"
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={toggleAll}
                  aria-label="Select all rows"
                />
              </Table.Th>
              {columns.map((col) => (
                <Table.Th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align ?? "left" }}
                >
                  {col.header}
                  {col.hiddenHeaderLabel && (
                    <VisuallyHidden>{col.hiddenHeaderLabel}</VisuallyHidden>
                  )}
                </Table.Th>
              ))}
              <Table.Th className={styles.controlCell}>
                <VisuallyHidden>Reorder</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columnCount} role="status">
                  {emptyMessage}
                </Table.Td>
              </Table.Tr>
            ) : (
              <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                {data.map((row) => (
                  <EditableRow
                    key={row.id}
                    row={row}
                    columns={columns}
                    selected={selectedIds.has(row.id)}
                    onToggle={toggleRow}
                    rowLabel={getRowLabel?.(row) ?? `row ${row.id}`}
                  />
                ))}
              </SortableContext>
            )}
          </Table.Tbody>
        </Table>
      </DndContext>
      {children}
    </div>
  );
};
