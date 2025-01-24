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
import { useDispatch, useSelector } from "react-redux";

import { useExerciseSearch } from "@/hooks/useExerciseSearch";
import { Exercise } from "@/types/exercises";

export const SearchExercises = () => {
  const { loading, error, exercises, refetch } = useExerciseSearch();
  const exerciseTypes = useSelector(datasetSelectors.getQuestionTypeOptions);
  const dispatch = useDispatch();
  const selectedExercises = useSelector(searchExercisesSelectors.getSelectedExercises);

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

  return (
    <DataTable
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
      header={!!selectedExercises.length && <SearchExercisesHeader />}
    >
      <Column selectionMode="multiple"></Column>
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
      <Column field="qnumber" header="Question" sortable></Column>
      <Column field="topic" header="Topic" sortable></Column>
    </DataTable>
  );
};
