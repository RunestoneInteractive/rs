import { useCallback, useMemo, useState } from "react";

import { DataGrid } from "@components/ui/DataGrid";
import { Icon } from "@components/ui/Icon";
import { SearchInput } from "@components/ui/SearchInput";
import { ActionIcon, Button, Group, Skeleton, Switch, Text, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ColumnDef, OnChangeFn, SortingState } from "@tanstack/react-table";
import classNames from "classnames";

import { Assignment } from "@/types/assignment";
import { formatLocalDateForDisplay, formatUTCDateForDisplay } from "@/utils/date";

import { VisibilityDropdown } from "./VisibilityDropdown";

import styles from "./AssignmentList.module.css";

interface AssignmentListProps {
  assignments: Assignment[];
  loading?: boolean;
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  onCreateNew: () => void;
  onEdit: (assignment: Assignment) => void;
  onDuplicate: (assignment: Assignment) => void;
  onEnforceDueChange: (assignment: Assignment, enforce_due: boolean) => void;
  onVisibilityChange: (
    assignment: Assignment,
    data: { visible: boolean; visible_on: string | null; hidden_on: string | null }
  ) => void;
  onRemove: (assignment: Assignment) => void;
}

const SORT_STORAGE_KEY = "assignmentList_sortField";
const ORDER_STORAGE_KEY = "assignmentList_sortOrder";
const TABLE_MIN_WIDTH = 880;
const SKELETON_ROW_COUNT = 6;

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
};

const ListSkeleton = () => (
  <div className={styles.tableCard}>
    <div className={styles.skeletonRows} data-testid="assignment-list-skeleton">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <Skeleton height={14} width="22%" />
          <Skeleton height={20} width={72} radius="xl" />
          <Skeleton height={14} width="14%" />
          <Skeleton height={14} width="14%" />
          <Skeleton height={14} width={40} />
          <Skeleton height={20} width={96} radius="xl" />
        </div>
      ))}
    </div>
  </div>
);

export const AssignmentList = ({
  assignments,
  loading = false,
  globalFilter,
  setGlobalFilter,
  onCreateNew,
  onEdit,
  onDuplicate,
  onEnforceDueChange,
  onVisibilityChange,
  onRemove
}: AssignmentListProps) => {
  const [sortField, setSortField] = useState<string>(
    () => localStorage.getItem(SORT_STORAGE_KEY) || "name"
  );
  const [sortDesc, setSortDesc] = useState<boolean>(() => {
    const stored = localStorage.getItem(ORDER_STORAGE_KEY);

    return stored ? Number(stored) === -1 : false;
  });

  const sorting: SortingState = useMemo(
    () => [{ id: sortField, desc: sortDesc }],
    [sortField, sortDesc]
  );

  const handleSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];

      if (!first) {
        return;
      }
      setSortField(first.id);
      setSortDesc(first.desc);
      localStorage.setItem(SORT_STORAGE_KEY, first.id);
      localStorage.setItem(ORDER_STORAGE_KEY, String(first.desc ? -1 : 1));
    },
    [sorting]
  );

  const filteredAssignments = useMemo(() => {
    const query = globalFilter.trim().toLowerCase();

    if (!query) {
      return assignments;
    }
    return assignments.filter((a) => a.name?.toLowerCase().includes(query));
  }, [assignments, globalFilter]);

  const confirmRemove = useCallback(
    (rowData: Assignment) => {
      modals.openConfirmModal({
        title: "Delete assignment",
        children: (
          <Text size="sm">Delete &quot;{rowData.name}&quot;? This can&apos;t be undone.</Text>
        ),
        labels: { confirm: "Delete", cancel: "Cancel" },
        confirmProps: { color: "red" },
        onConfirm: () => onRemove(rowData)
      });
    },
    [onRemove]
  );

  const columns = useMemo<ColumnDef<Assignment, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        meta: { cellClassName: styles.clickableCell, onCellClick: onEdit },
        cell: ({ row }) => (
          <button
            type="button"
            className={styles.nameButton}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(row.original);
            }}
            title="Click to edit assignment"
          >
            {row.original.name}
          </button>
        )
      },
      {
        accessorKey: "kind",
        header: "Type",
        meta: { cellClassName: styles.clickableCell, onCellClick: onEdit },
        cell: ({ row }) => (
          <span
            className={classNames(
              styles.typeTag,
              styles[row.original.kind?.toLowerCase() || "default"]
            )}
          >
            {row.original.kind || "Unknown"}
          </span>
        )
      },
      {
        accessorKey: "duedate",
        header: "Due date",
        meta: {
          cellClassName: classNames(styles.dateCell, styles.clickableCell),
          onCellClick: onEdit
        },
        cell: ({ row }) => formatLocalDateForDisplay(row.original.duedate, DATE_FORMAT)
      },
      {
        accessorKey: "updated_date",
        header: "Last updated",
        meta: {
          cellClassName: classNames(styles.dateCell, styles.clickableCell),
          onCellClick: onEdit
        },
        cell: ({ row }) =>
          row.original.updated_date
            ? formatUTCDateForDisplay(row.original.updated_date, DATE_FORMAT)
            : ""
      },
      {
        accessorKey: "enforce_due",
        header: "Late submissions",
        enableSorting: false,
        meta: { align: "center" },
        cell: ({ row }) => (
          <Group justify="center">
            <Tooltip
              label={
                !row.original.enforce_due
                  ? "Late submissions are allowed"
                  : "Late submissions are not allowed"
              }
              position="top"
            >
              <Switch
                size="sm"
                aria-label={`Allow late submissions for ${row.original.name}`}
                checked={!row.original.enforce_due}
                onChange={(e) => onEnforceDueChange(row.original, !e.currentTarget.checked)}
              />
            </Tooltip>
          </Group>
        )
      },
      {
        accessorKey: "points",
        header: "Points",
        meta: { align: "right", cellClassName: "numeric" }
      },
      {
        id: "visible",
        header: "Visibility",
        enableSorting: false,
        cell: ({ row }) => (
          <VisibilityDropdown assignment={row.original} onChange={onVisibilityChange} />
        )
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "center", hiddenHeaderLabel: "Actions" },
        cell: ({ row }) => (
          <div className={styles.rowActions}>
            <Tooltip label="Preview as student" position="top">
              <ActionIcon
                variant="subtle"
                color="gray"
                size={40}
                aria-label="Preview as student"
                onClick={() => {
                  const { protocol, hostname } = window.location;
                  const previewUrl = `${protocol}//${hostname}/assignment/student/doAssignment?assignment_id=${row.original.id}`;

                  window.open(previewUrl, "_blank");
                }}
              >
                <Icon name="eye" />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Edit" position="top">
              <ActionIcon
                variant="subtle"
                color="gray"
                size={40}
                aria-label="Edit"
                onClick={() => onEdit(row.original)}
              >
                <Icon name="pencil" />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Duplicate" position="top">
              <ActionIcon
                variant="subtle"
                color="gray"
                size={40}
                aria-label="Duplicate"
                onClick={() => onDuplicate(row.original)}
              >
                <Icon name="copy" />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete" position="top">
              <ActionIcon
                variant="subtle"
                color="red"
                size={40}
                aria-label="Delete"
                onClick={() => confirmRemove(row.original)}
              >
                <Icon name="trash" />
              </ActionIcon>
            </Tooltip>
          </div>
        )
      }
    ],
    [confirmRemove, onDuplicate, onEdit, onEnforceDueChange, onVisibilityChange]
  );

  const showEmptyState = !loading && assignments.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <h1 className={styles.pageTitle}>Assignments</h1>
          {!loading && <span className={styles.countBadge}>{assignments.length}</span>}
        </div>
        <div className={styles.headerActions}>
          <SearchInput
            value={globalFilter}
            onChange={setGlobalFilter}
            placeholder="Search assignments"
            className={styles.search}
          />
          <Button
            className={styles.primaryCta}
            leftSection={<Icon name="plus" />}
            onClick={onCreateNew}
          >
            New assignment
          </Button>
        </div>
      </div>
      {loading ? (
        <ListSkeleton />
      ) : showEmptyState ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Icon name="clipboard-list" size={28} />
          </div>
          <h2 className={styles.emptyTitle}>Create your first assignment</h2>
          <p className={styles.emptyText}>
            Assignments you create will show up here. Start with readings, exercises, or a quiz.
          </p>
          <Button
            className={styles.primaryCta}
            leftSection={<Icon name="plus" />}
            onClick={onCreateNew}
          >
            New assignment
          </Button>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <DataGrid
            data={filteredAssignments}
            columns={columns}
            getRowId={(row) => String(row.id)}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            emptyMessage="No assignments match your search"
            ariaLabel="Assignments"
            minWidth={TABLE_MIN_WIDTH}
            enableSortingRemoval={false}
          />
        </div>
      )}
    </div>
  );
};
