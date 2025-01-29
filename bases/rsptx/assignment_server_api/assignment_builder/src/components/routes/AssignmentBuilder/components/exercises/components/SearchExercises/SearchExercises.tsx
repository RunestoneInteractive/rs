import { ExercisePreviewModal } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreviewModal";
import { SearchExercisesHeader } from "@components/routes/AssignmentBuilder/components/exercises/components/SearchExercises/SearchExercisesHeader";
import { Loader } from "@components/ui/Loader";
import { datasetSelectors } from "@store/dataset/dataset.logic";
import {
  searchExercisesActions,
  searchExercisesSelectors
} from "@store/searchExercises/searchExercises.logic";
import { FilterMatchMode } from "primereact/api";
import { Chip } from "primereact/chip";
import { Column, ColumnFilterElementTemplateOptions } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { IconField } from "primereact/iconfield";
import { InputIcon } from "primereact/inputicon";
import { InputText } from "primereact/inputtext";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useExerciseSearch } from "@/hooks/useExerciseSearch";
import { Exercise } from "@/types/exercises";

export const SearchExercises = () => {
  const { loading, error, exercises, refetch } = useExerciseSearch();
  const exerciseTypes = useSelector(datasetSelectors.getQuestionTypeOptions);
  const dispatch = useDispatch();
  const selectedExercises = useSelector(searchExercisesSelectors.getSelectedExercises);

  const [filters, setFilters] = useState({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    question_type: { value: null, matchMode: FilterMatchMode.CONTAINS },
    author: { value: null, matchMode: FilterMatchMode.CONTAINS }
  });
  const [globalFilterValue, setGlobalFilterValue] = useState("");

  const onGlobalFilterChange = (e: any) => {
    const value = e.target.value;
    // eslint-disable-next-line no-underscore-dangle
    let _filters = { ...filters };

    _filters.global.value = value;

    setFilters(_filters);
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
    return exerciseTypes.find((t) => t.value === value)?.label || value;
  };

  const exerciseTypeFilter = (options: ColumnFilterElementTemplateOptions) => {
    console.log(options);
    return (
      <Dropdown
        id="exerciseTypeFilter"
        options={exerciseTypes}
        placeholder="Select exercise type"
        optionLabel="label"
        value={options.value}
        onChange={(e) => {
          options.filterCallback(e.value);
        }}
      />
    );
  };

  const renderHeader = () => {
    return (
      <div className="flex justify-content-between align-items-center">
        <div>{!!selectedExercises.length && <SearchExercisesHeader />}</div>
        <IconField iconPosition="left">
          <InputIcon className="pi pi-search" />
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder="Search by question text"
          />
        </IconField>
      </div>
    );
  };

  const header = renderHeader();

  return (
    <DataTable
      style={{ height: "75vh" }}
      value={exercises}
      sortMode="single"
      scrollable
      size="small"
      stripedRows
      showGridlines
      selection={selectedExercises}
      selectionMode="multiple"
      onSelectionChange={(e) => setSelectedExercises(e.value as unknown as Exercise[])}
      sortField="name"
      sortOrder={1}
      removableSort
      className="table_sticky-header"
      header={header}
      filters={filters}
      globalFilterFields={["question_json.statement"]}
    >
      <Column selectionMode="multiple"></Column>
      <Column field="qnumber" header="Question" sortable></Column>
      <Column
        style={{ width: "14rem" }}
        field="name"
        header="Name"
        sortable
        filter
        showFilterOperator={false}
        showFilterMenuOptions={false}
        filterMatchMode={FilterMatchMode.CONTAINS}
      ></Column>
      <Column
        style={{ maxWidth: "10rem" }}
        field="question_json.statement"
        header="Statement"
      ></Column>
      <Column
        field="question_type"
        header="Question Type"
        sortable
        filter
        body={(data: Exercise) => displayExerciseType(data.question_type)}
        showFilterOperator={false}
        showFilterMenuOptions={false}
        showFilterMatchModes={false}
        filterMenuStyle={{ width: "16rem" }}
        style={{ minWidth: "16rem" }}
        filterElement={exerciseTypeFilter}
      ></Column>
      <Column
        style={{ width: "5rem" }}
        field="htmlsrc"
        header="Preview"
        body={(data: Exercise) => {
          if (!data?.htmlsrc) {
            return null;
          }

          return <ExercisePreviewModal htmlsrc={data.htmlsrc} />;
        }}
      ></Column>
      <Column
        field="author"
        header="Author"
        sortable
        filter
        filterMatchMode={FilterMatchMode.CONTAINS}
        showFilterOperator={false}
        showFilterMenuOptions={false}
        showFilterMatchModes={false}
      ></Column>
      <Column
        style={{ maxWidth: "100%" }}
        field="tags"
        header="Tags"
        sortable
        body={(data: Exercise) => {
          return (
            <div style={{ width: "12rem" }} className="flex gap-1 flex-wrap flex-row">
              {data.tags &&
                data.tags.split(",").map((t, i) => <Chip label={t.trim()} key={`${t}${i}`} />)}
            </div>
          );
        }}
      ></Column>
      <Column field="topic" header="Topic" sortable></Column>
    </DataTable>
  );
};
