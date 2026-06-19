import { ErrorState } from "@components/routes/AssignmentBuilder/components/ErrorState/ErrorState";
import { ExercisePreviewModal } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreviewModal";
import { useScrollShadow } from "@components/shell/useScrollShadow";
import { DataGrid } from "@components/ui/DataGrid";
import { ExerciseTypeTag } from "@components/ui/ExerciseTypeTag";
import { FilterMultiSelect } from "@components/ui/FilterMultiSelect/FilterMultiSelect";
import { Icon } from "@components/ui/Icon";
import { TabToolbar } from "@components/ui/TabToolbar/TabToolbar";
import {
  ActionIcon,
  Button,
  Center,
  Checkbox,
  Group,
  Loader,
  Switch,
  TagsInput,
  Text,
  Tooltip
} from "@mantine/core";
import {
  ColumnDef,
  ColumnFiltersState,
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState
} from "@tanstack/react-table";
import {
  searchExercisesActions,
  searchExercisesSelectors
} from "@store/searchExercises/searchExercises.logic";
import { datasetSelectors } from "@store/dataset/dataset.logic";
import { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useSmartExerciseSearch } from "@/hooks/useSmartExerciseSearch";
import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";
import { Exercise } from "@/types/exercises";

import { CopyExerciseModal } from "../CopyExercise/CopyExerciseModal";

import styles from "./SmartSearchExercises.module.css";

interface SmartSearchExercisesProps {
  setCurrentEditExercise?: (exercise: Exercise | null) => void;
  setViewMode?: (mode: "list" | "browse" | "search" | "create" | "edit") => void;
}

type FilterMetaValue = { value: string | string[] | null };

const MATCH_CONTAINS = "contains";
const MATCH_IN = "in";

const renderEllipsis = (text?: string | null) => (
  <div className={styles.ellipsisText} title={text ?? ""}>
    {text}
  </div>
);

export const SmartSearchExercises = ({
  setCurrentEditExercise,
  setViewMode
}: SmartSearchExercisesProps) => {
  const dispatch = useDispatch();
  const selectedExercises = useSelector(searchExercisesSelectors.getSelectedExercises);
  const exerciseTypes = useSelector(datasetSelectors.getQuestionTypeOptions);
  const { updateAssignmentExercises, isUpdating } = useUpdateAssignmentExercise();
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [selectedExerciseForCopy, setSelectedExerciseForCopy] = useState<Exercise | null>(null);
  const { sentinelRef, scrolled } = useScrollShadow();

  const {
    exercises,
    pagination,
    loading,
    initialLoading,
    error,
    searchParams,
    filters,
    updateFilters,
    updateSorting,
    updatePagination,
    onGlobalFilterChange,
    toggleBaseCourse,
    refetch
  } = useSmartExerciseSearch();

  const setSelectedExercises = useCallback(
    (ex: Exercise[]) => {
      dispatch(searchExercisesActions.setSelectedExercises(ex));
    },
    [dispatch]
  );

  const onAddSelectedClick = async () => {
    if (selectedExercises.length === 0) return;

    await updateAssignmentExercises(
      {
        idsToAdd: selectedExercises.map((ex) => ex.id),
        isReading: false
      },
      () => {
        setSelectedExercises([]);
        refetch();
      }
    );
  };

  const handleBackToList = () => {
    setSelectedExercises([]);
    setViewMode?.("list");
  };

  const handleCopyClick = useCallback((exercise: Exercise) => {
    setSelectedExerciseForCopy(exercise);
    setCopyModalVisible(true);
  }, []);

  const handleCopyModalHide = () => {
    setCopyModalVisible(false);
    setSelectedExerciseForCopy(null);
  };

  const globalValue = (filters.global as FilterMetaValue).value;
  const globalTerms = typeof globalValue === "string" ? globalValue.split(" ").filter(Boolean) : [];
  const selectedTypes = ((filters.question_type as FilterMetaValue).value as string[]) ?? [];

  const sorting: SortingState = useMemo(
    () => [{ id: searchParams.sorting.field, desc: searchParams.sorting.order === -1 }],
    [searchParams.sorting.field, searchParams.sorting.order]
  );

  const paginationState: PaginationState = useMemo(
    () => ({ pageIndex: searchParams.page, pageSize: searchParams.limit }),
    [searchParams.page, searchParams.limit]
  );

  const columnFilters: ColumnFiltersState = useMemo(() => {
    const result: ColumnFiltersState = [];

    (["name", "author", "topic"] as const).forEach((id) => {
      const value = (filters[id] as FilterMetaValue | undefined)?.value;

      if (value) {
        result.push({ id, value });
      }
    });
    return result;
  }, [filters]);

  const rowSelection: RowSelectionState = useMemo(
    () => Object.fromEntries(selectedExercises.map((ex) => [String(ex.id), true])),
    [selectedExercises]
  );

  const handleSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];

      if (!first) return;
      updateSorting(first.id, first.desc ? -1 : 1);
    },
    [sorting, updateSorting]
  );

  const handlePaginationChange: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(paginationState) : updater;

      updatePagination(next.pageIndex, next.pageSize);
    },
    [paginationState, updatePagination]
  );

  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(columnFilters) : updater;
      const valueOf = (id: string) => (next.find((f) => f.id === id)?.value as string) ?? null;

      updateFilters({
        name: { value: valueOf("name"), matchMode: MATCH_CONTAINS },
        author: { value: valueOf("author"), matchMode: MATCH_CONTAINS },
        topic: { value: valueOf("topic"), matchMode: MATCH_CONTAINS }
      });
    },
    [columnFilters, updateFilters]
  );

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      const selectedIds = new Set(Object.keys(next).filter((key) => next[key]));
      const byId = new Map<string, Exercise>();

      selectedExercises.forEach((ex) => byId.set(String(ex.id), ex));
      exercises.forEach((ex) => byId.set(String(ex.id), ex));

      const nextSelected = [...selectedIds]
        .map((id) => byId.get(id))
        .filter((ex): ex is Exercise => !!ex);

      setSelectedExercises(nextSelected);
    },
    [rowSelection, selectedExercises, exercises, setSelectedExercises]
  );

  const columns = useMemo<ColumnDef<Exercise, unknown>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        meta: { headerStyle: { width: 40 } },
        header: ({ table }) => (
          <Checkbox
            size="sm"
            aria-label="Select all"
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            size="sm"
            aria-label={`Select ${row.original.name}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        )
      },
      {
        id: "preview",
        header: "",
        enableSorting: false,
        meta: { headerStyle: { width: 48 }, hiddenHeaderLabel: "Preview" },
        cell: ({ row }) =>
          row.original.htmlsrc ? (
            <ExercisePreviewModal
              htmlsrc={row.original.htmlsrc}
              questionName={row.original.name}
              triggerButton={
                <ActionIcon variant="subtle" color="gray" aria-label="Preview exercise">
                  <Icon name="eye" />
                </ActionIcon>
              }
            />
          ) : null
      },
      {
        id: "copy",
        header: "",
        enableSorting: false,
        meta: { headerStyle: { width: 48 }, hiddenHeaderLabel: "Copy" },
        cell: ({ row }) =>
          row.original.question_json ? (
            <Tooltip label="Copy exercise" position="top">
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label="Copy exercise"
                onClick={() => handleCopyClick(row.original)}
              >
                <Icon name="copy" />
              </ActionIcon>
            </Tooltip>
          ) : null
      },
      {
        accessorKey: "qnumber",
        header: "Number",
        enableSorting: false,
        meta: { headerStyle: { width: 112 } },
        cell: ({ row }) => renderEllipsis(row.original.qnumber)
      },
      {
        accessorKey: "name",
        header: "Name",
        meta: {
          headerStyle: { minWidth: 220 },
          filter: { variant: "text", placeholder: "Search by name" }
        },
        cell: ({ row }) => (
          <div className={styles.monoName} data-mono-name="" title={row.original.name ?? ""}>
            {row.original.name}
          </div>
        )
      },
      {
        accessorKey: "question_type",
        header: "Type",
        meta: { headerStyle: { width: 140 } },
        cell: ({ row }) => <ExerciseTypeTag type={row.original.question_type} />
      },
      {
        accessorKey: "author",
        header: "Author",
        meta: {
          headerStyle: { minWidth: 160 },
          filter: { variant: "text", placeholder: "Search by author" }
        },
        cell: ({ row }) => renderEllipsis(row.original.author)
      },
      {
        accessorKey: "tags",
        header: "Tags",
        enableSorting: false,
        meta: { headerStyle: { minWidth: 160 } },
        cell: ({ row }) => {
          const tags = row.original.tags;

          if (!tags) return null;
          const list = tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
          const maxVisible = 3;

          return (
            <Group gap={4} wrap="nowrap" className={styles.tagContainer}>
              {list.slice(0, maxVisible).map((tag, index) => (
                <span key={`${tag}_${index}`} className={styles.tag}>
                  {tag}
                </span>
              ))}
              {list.length > maxVisible && (
                <span className={styles.moreTags}>+{list.length - maxVisible}</span>
              )}
            </Group>
          );
        }
      },
      {
        accessorKey: "topic",
        header: "Topic",
        meta: {
          headerStyle: { minWidth: 160 },
          filter: { variant: "text", placeholder: "Search by topic" }
        },
        cell: ({ row }) => renderEllipsis(row.original.topic)
      }
    ],
    [handleCopyClick]
  );

  if (error) {
    return (
      <ErrorState
        title="Couldn't search exercises"
        message="Try again."
        retryLabel="Try again"
        onRetry={refetch}
      />
    );
  }

  return (
    <section className={styles.card} aria-label="Search exercises">
      <TabToolbar
        title="Search exercises"
        count={pagination?.total ?? 0}
        scrolled={scrolled}
        leading={
          setViewMode && (
            <Tooltip label="Back to exercises" position="bottom" openDelay={500}>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={handleBackToList}
                aria-label="Back to exercises"
              >
                <Icon name="arrow-left" />
              </ActionIcon>
            </Tooltip>
          )
        }
      >
        <TagsInput
          className={styles.search}
          value={globalTerms}
          onChange={(terms) => onGlobalFilterChange(terms.join(" "))}
          placeholder="Search terms…"
          leftSection={<Icon name="search" />}
          clearable
        />
        <Switch
          size="sm"
          label={searchParams.use_base_course ? "Book exercises" : "All exercises"}
          labelPosition="left"
          checked={searchParams.use_base_course}
          onChange={(e) => toggleBaseCourse(e.currentTarget.checked)}
        />
        <FilterMultiSelect
          label="Exercise types"
          options={exerciseTypes}
          value={selectedTypes}
          onChange={(value) => updateFilters({ question_type: { value, matchMode: MATCH_IN } })}
        />
      </TabToolbar>

      <div className={styles.selectionBar}>
        <div className={styles.selectionGroup}>
          {selectedExercises.length > 0 ? (
            <>
              <Button
                size="xs"
                leftSection={<Icon name="plus" />}
                loading={isUpdating}
                onClick={onAddSelectedClick}
              >
                Add {selectedExercises.length} selected
              </Button>
              <Button
                size="xs"
                variant="default"
                leftSection={<Icon name="times" />}
                onClick={() => setSelectedExercises([])}
              >
                Clear selection
              </Button>
            </>
          ) : (
            <Text size="sm" c="dimmed">
              Select exercises to add
            </Text>
          )}
        </div>
        <div className={styles.selectionGroup}>
          {pagination && (
            <span className={styles.resultCount}>
              Showing {exercises.length} of {pagination.total} exercises
            </span>
          )}
          {loading && !initialLoading && <Loader size="xs" />}
        </div>
      </div>

      {initialLoading ? (
        <Center className={styles.initialLoading} role="status">
          <Loader />
          <Text size="sm" c="dimmed">
            Loading exercises…
          </Text>
        </Center>
      ) : (
        <div className={styles.body}>
          <DataGrid
            data={exercises}
            columns={columns}
            getRowId={(row) => String(row.id)}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={handleRowSelectionChange}
            enableColumnFilters
            columnFilters={columnFilters}
            onColumnFiltersChange={handleColumnFiltersChange}
            manualFiltering
            sorting={sorting}
            onSortingChange={handleSortingChange}
            manualSorting
            enableSortingRemoval={false}
            pagination={paginationState}
            onPaginationChange={handlePaginationChange}
            pageCount={pagination?.pages ?? -1}
            manualPagination
            pageSizeOptions={[10, 20, 50]}
            loading={loading}
            emptyMessage="No exercises found"
            ariaLabel="Search exercises"
            fillHeight
            scrollSentinelRef={sentinelRef}
          />
        </div>
      )}

      <CopyExerciseModal
        visible={copyModalVisible}
        onHide={handleCopyModalHide}
        exercise={selectedExerciseForCopy}
        setCurrentEditExercise={setCurrentEditExercise}
        setViewMode={setViewMode}
      />
    </section>
  );
};
