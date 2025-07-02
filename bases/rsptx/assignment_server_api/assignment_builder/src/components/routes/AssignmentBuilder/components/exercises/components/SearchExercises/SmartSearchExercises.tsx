import { ExercisePreviewModal } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreviewModal";
import { ExerciseTypeTag } from "@components/ui/ExerciseTypeTag";
import { datasetSelectors } from "@store/dataset/dataset.logic";
import {
  searchExercisesActions,
  searchExercisesSelectors
} from "@store/searchExercises/searchExercises.logic";
import { FilterMatchMode, SortOrder } from "primereact/api";
import { Button } from "primereact/button";
import { Chip } from "primereact/chip";
import { Column } from "primereact/column";
import { DataTable, DataTableFilterMetaData } from "primereact/datatable";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { Paginator } from "primereact/paginator";
import { ProgressSpinner } from "primereact/progressspinner";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useSmartExerciseSearch } from "@/hooks/useSmartExerciseSearch";
import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";
import { Exercise } from "@/types/exercises";

import { CopyExerciseModal } from "../CopyExercise/CopyExerciseModal";

import styles from "./SmartSearchExercises.module.css";

/**
 * Smart exercise search component with fixed layout and enhanced UX
 */
export const SmartSearchExercises = () => {
  const dispatch = useDispatch();
  const selectedExercises = useSelector(searchExercisesSelectors.getSelectedExercises);
  const exerciseTypes = useSelector(datasetSelectors.getQuestionTypeOptions);
  const { updateAssignmentExercises } = useUpdateAssignmentExercise();
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [selectedExerciseForCopy, setSelectedExerciseForCopy] = useState<Exercise | null>(null);

  // Use the smart exercise search hook
  const {
    exercises,
    pagination,
    loading,
    initialLoading,
    error,
    searchParams,
    filters,
    updateFilters,
    onGlobalFilterChange,
    onPage,
    onSort,
    onFilter,
    refetch
  } = useSmartExerciseSearch();

  // Set selected exercises
  const setSelectedExercises = (ex: Exercise[]) => {
    dispatch(searchExercisesActions.setSelectedExercises(ex));
  };

  // Add selected exercises to assignment
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

  // Error state UI
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <i
          className="pi pi-exclamation-triangle"
          style={{ fontSize: "2.5rem", color: "var(--red-500)" }}
        ></i>
        <p>Error loading exercises</p>
        <Button label="Retry" icon="pi pi-refresh" rounded onClick={refetch} />
      </div>
    );
  }

  const renderExerciseType = (rowData: Exercise) => {
    return <ExerciseTypeTag type={rowData.question_type} />;
  };

  const renderTags = (rowData: Exercise) => {
    if (!rowData.tags) return null;

    const tagsList = rowData.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const maxVisibleTags = 3;

    return (
      <div className={styles.tagContainer}>
        {tagsList.slice(0, maxVisibleTags).map((tag, index) => (
          <Chip key={`${tag}_${index}`} label={tag} className={styles.tag} />
        ))}
        {tagsList.length > maxVisibleTags && (
          <span className={styles.moreTags}>+{tagsList.length - maxVisibleTags}</span>
        )}
      </div>
    );
  };

  const renderEllipsisText = (text: string) => {
    return (
      <div className={styles.ellipsisText} title={text}>
        {text}
      </div>
    );
  };

  const renderPreview = (data: Exercise) => {
    return data?.htmlsrc ? (
      <ExercisePreviewModal
        htmlsrc={data.htmlsrc}
        triggerButton={<Button icon="pi pi-eye" rounded text aria-label="Preview exercise" />}
      />
    ) : null;
  };

  const renderCopyButton = (data: Exercise) => {
    return getIsCopyable(data) ? (
      <Button
        icon="pi pi-copy"
        rounded
        text
        aria-label="Copy exercise"
        onClick={() => handleCopyClick(data)}
        title="Copy exercise"
      />
    ) : null;
  };

  // Convert sort order for PrimeReact
  const primeSortOrder: SortOrder = searchParams.sorting.order === 1 ? 1 : -1;

  return (
    <div className={styles.container}>
      {/* Top controls block */}
      <div className={styles.topControls}>
        <div className={styles.searchAndFilters}>
          {/* Global search field */}
          <div className={styles.searchField}>
            <span className={styles.searchWrapper}>
              <i className={styles.searchIcon + " pi pi-search"} />
              <InputText
                value={(filters.global as DataTableFilterMetaData).value}
                onChange={(e) => onGlobalFilterChange(e.target.value)}
                placeholder="Search..."
                className={styles.searchInput + " w-full"}
              />
            </span>
          </div>

          {/* Exercise type filter */}
          <div className={styles.typeFilter}>
            <MultiSelect
              value={(filters.question_type as DataTableFilterMetaData).value}
              options={exerciseTypes}
              onChange={(e) => {
                updateFilters({
                  question_type: { value: e.value, matchMode: FilterMatchMode.IN }
                });
              }}
              placeholder="Type"
              className="w-full"
              display="chip"
            />
          </div>
        </div>

        {/* Status bar with pagination and loading indicator */}
        <div className={styles.statusBar}>
          <div className={styles.actionButtons}>
            {selectedExercises.length > 0 ? (
              <>
                <Button
                  className={styles.addButton}
                  icon="pi pi-plus"
                  label={`Add ${selectedExercises.length} selected`}
                  onClick={onAddSelectedClick}
                  tooltip="Add selected exercises to assignment"
                  tooltipOptions={{ position: "top" }}
                  size="small"
                  severity="success"
                />
                <Button
                  className={styles.clearButton}
                  icon="pi pi-times"
                  label="Clear selection"
                  onClick={() => setSelectedExercises([])}
                  tooltip="Clear exercise selection"
                  tooltipOptions={{ position: "top" }}
                  size="small"
                  outlined
                />
              </>
            ) : (
              <span className={styles.noSelectionText}>Select exercises to add</span>
            )}
          </div>

          <div className={styles.paginationContainer}>
            <div className={styles.paginationInfo}>
              {pagination && (
                <span>
                  Showing {exercises.length > 0 ? exercises.length : 0} of {pagination.total}{" "}
                  exercises
                </span>
              )}
            </div>
            <Paginator
              first={searchParams.page * searchParams.limit}
              rows={searchParams.limit}
              totalRecords={pagination?.total || 0}
              rowsPerPageOptions={[10, 20, 50]}
              onPageChange={onPage}
              template="PrevPageLink PageLinks NextPageLink RowsPerPageDropdown"
              className={styles.paginationControls}
            />
            <div className={styles.loadingIndicatorFixed}>
              {loading && <ProgressSpinner style={{ width: "1.5rem", height: "1.5rem" }} />}
            </div>
          </div>
        </div>
      </div>

      {/* Table wrapper with fixed height */}
      <div className={styles.tableWrapper}>
        {initialLoading ? (
          <div className={styles.initialLoadingContainer}>
            <ProgressSpinner />
            <div className={styles.loadingText}>Loading exercises...</div>
          </div>
        ) : (
          <DataTable
            value={exercises}
            lazy
            dataKey="id"
            scrollable
            scrollHeight="flex"
            first={searchParams.page * searchParams.limit}
            rows={searchParams.limit}
            totalRecords={pagination?.total || 0}
            onPage={onPage}
            sortField={searchParams.sorting.field}
            sortOrder={primeSortOrder}
            onSort={onSort}
            onFilter={onFilter}
            size="small"
            stripedRows
            showGridlines
            selection={selectedExercises}
            selectionMode="multiple"
            onSelectionChange={(e) => setSelectedExercises(e.value as Exercise[])}
            className={styles.table}
            filters={filters}
            globalFilterFields={["name", "question_type", "author", "topic", "tags"]}
            emptyMessage={
              <div className={styles.emptyMessage}>
                <i
                  className="pi pi-search"
                  style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}
                ></i>
                <p>No exercises found</p>
              </div>
            }
            rowHover
            filterDisplay="menu"
            tableStyle={{ tableLayout: "fixed" }} // Fixed table layout
            reorderableColumns
          >
            {/* Multiple selection column */}
            <Column
              selectionMode="multiple"
              headerStyle={{ width: "3rem" }}
              style={{ width: "3rem" }}
              className={styles.column}
              headerClassName={styles.selectionColumnHeader}
            />

            {/* Preview */}
            <Column
              headerStyle={{ width: "4rem" }}
              style={{ width: "4rem" }}
              body={renderPreview}
              frozen={true}
              className="preview-column"
            />

            {/* Copy button */}
            <Column
              headerStyle={{ width: "4rem" }}
              style={{ width: "4rem" }}
              body={renderCopyButton}
              frozen={true}
              className="copy-column"
            />

            {/* Question number */}
            <Column
              field="qnumber"
              header="Number"
              headerStyle={{ width: "7rem" }}
              style={{ width: "7rem" }}
              body={(rowData) => renderEllipsisText(rowData.qnumber)}
              className="number-column"
            />

            {/* Question name */}
            <Column
              field="name"
              header="Name"
              sortable
              filter
              filterPlaceholder="Search by name"
              headerStyle={{ width: "20rem" }}
              style={{ width: "20rem" }}
              body={(rowData) => renderEllipsisText(rowData.name)}
              showFilterMenu={true}
              filterMenuStyle={{ width: "15rem" }}
              className="name-column"
            />

            {/* Question type */}
            <Column
              field="question_type"
              header="Type"
              sortable
              showFilterMenu={false}
              body={renderExerciseType}
              headerStyle={{ width: "10rem" }}
              style={{ width: "10rem" }}
              className="type-column"
            />

            {/* Author */}
            <Column
              field="author"
              header="Author"
              sortable
              filter
              filterPlaceholder="Search by author"
              headerStyle={{ width: "12rem" }}
              style={{ width: "12rem" }}
              body={(rowData) => renderEllipsisText(rowData.author)}
              showFilterMenu={true}
              filterMenuStyle={{ width: "15rem" }}
              className="author-column"
            />

            {/* Tags */}
            <Column
              field="tags"
              header="Tags"
              body={renderTags}
              headerStyle={{ width: "15rem" }}
              style={{ width: "15rem" }}
              className="tags-column"
            />

            {/* Topic */}
            <Column
              field="topic"
              header="Topic"
              sortable
              filter
              filterPlaceholder="Search by topic"
              headerStyle={{ width: "15rem" }}
              style={{ width: "15rem" }}
              body={(rowData) => renderEllipsisText(rowData.topic)}
              showFilterMenu={true}
              filterMenuStyle={{ width: "15rem" }}
              className="topic-column"
            />
          </DataTable>
        )}
      </div>

      <CopyExerciseModal
        visible={copyModalVisible}
        onHide={handleCopyModalHide}
        exercise={selectedExerciseForCopy}
        copyToAssignment={false}
      />
    </div>
  );
};
