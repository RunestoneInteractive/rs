import { ExercisePreviewModal } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreviewModal";
import { SearchExercisesHeader } from "@components/routes/AssignmentBuilder/components/exercises/components/SearchExercises/SearchExercisesHeader";
import { ExerciseTypeTag } from "@components/ui/ExerciseTypeTag";
import { Loader } from "@components/ui/Loader";
import { SearchInput } from "@components/ui/SearchInput";
import { datasetSelectors } from "@store/dataset/dataset.logic";
import {
  searchExercisesActions,
  searchExercisesSelectors
} from "@store/searchExercises/searchExercises.logic";
import { FilterMatchMode } from "primereact/api";
import { Chip } from "primereact/chip";
import { Column } from "primereact/column";
import { DataTable, DataTableFilterMeta } from "primereact/datatable";
import { MultiSelect } from "primereact/multiselect";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useExerciseSearch } from "@/hooks/useExerciseSearch";
import { Exercise } from "@/types/exercises";

export const SearchExercises = () => {
  const { loading, error, exercises, refetch } = useExerciseSearch();
  const exerciseTypes = useSelector(datasetSelectors.getQuestionTypeOptions);
  const dispatch = useDispatch();
  const selectedExercises = useSelector(searchExercisesSelectors.getSelectedExercises);

  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    question_type: { value: null, matchMode: FilterMatchMode.EQUALS },
    author: { value: null, matchMode: FilterMatchMode.CONTAINS },
    topic: { value: null, matchMode: FilterMatchMode.CONTAINS }
  });

  const [globalFilterValue, setGlobalFilterValue] = useState<string>("");

  const onGlobalFilterChange = (value: string) => {
    let copiedFilters = { ...filters };

    copiedFilters.global = { value, matchMode: FilterMatchMode.CONTAINS };
    setFilters(copiedFilters);
    setGlobalFilterValue(value);
  };

  const setSelectedExercises = (ex: Exercise[]) => {
    dispatch(searchExercisesActions.setSelectedExercises(ex));
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

  const displayExerciseType = (value: string) => {
    return <ExerciseTypeTag type={value} />;
  };

  const renderHeader = () => {
    return (
      <div className="flex flex-column gap-2">
        <div>{!!selectedExercises.length && <SearchExercisesHeader />}</div>
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchInput
              value={globalFilterValue}
              onChange={onGlobalFilterChange}
              placeholder="Search exercises..."
              className="w-full"
            />
          </div>
          <div className="w-25rem">
            <MultiSelect
              value={(filters.question_type as any)?.value}
              options={exerciseTypes}
              onChange={(e) => {
                setFilters({
                  ...filters,
                  question_type: { value: e.value, matchMode: FilterMatchMode.IN }
                });
              }}
              placeholder="Filter by type"
              className="w-full"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <DataTable
      value={exercises}
      sortMode="multiple"
      removableSort
      scrollable
      scrollHeight="calc(100vh - 250px)"
      size="small"
      stripedRows
      showGridlines
      selection={selectedExercises}
      selectionMode="multiple"
      onSelectionChange={(e) => setSelectedExercises(e.value as Exercise[])}
      sortField="name"
      sortOrder={1}
      className="table_sticky-header"
      header={renderHeader()}
      filters={filters}
      globalFilterFields={["name", "question_type", "author", "topic", "tags"]}
      emptyMessage="No exercises found"
    >
      <Column selectionMode="multiple" style={{ width: "3rem" }} />
      <Column field="qnumber" header="Question" sortable style={{ width: "8rem" }} />
      <Column
        field="name"
        header="Name"
        sortable
        filter
        filterPlaceholder="Search by name"
        style={{ width: "14rem" }}
      />
      <Column
        field="question_type"
        header="Type"
        sortable
        filter
        body={(data: Exercise) => displayExerciseType(data.question_type)}
        style={{ width: "10rem" }}
      />
      <Column
        field="author"
        header="Author"
        sortable
        filter
        filterPlaceholder="Search by author"
        style={{ width: "10rem" }}
      />
      <Column
        field="tags"
        header="Tags"
        sortable
        body={(data: Exercise) => {
          return (
            <div className="flex gap-1 flex-wrap">
              {data.tags &&
                data.tags.split(",").map((t, i) => <Chip key={`${t}${i}`} label={t.trim()} />)}
            </div>
          );
        }}
        style={{ minWidth: "12rem" }}
      />
      <Column
        field="topic"
        header="Topic"
        sortable
        filter
        filterPlaceholder="Search by topic"
        style={{ width: "10rem" }}
      />
      <Column
        style={{ width: "4rem" }}
        body={(data: Exercise) => {
          if (!data?.htmlsrc) {
            return null;
          }

          return (
            <ExercisePreviewModal
              htmlsrc={data.htmlsrc}
              triggerButton={<i className="pi pi-eye" style={{ cursor: "pointer" }} />}
            />
          );
        }}
      />
    </DataTable>
  );
};
