import { ExercisePreviewModal } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreviewModal";
import { SearchExercisesHeader } from "@components/routes/AssignmentBuilder/components/exercises/components/SearchExercises/SearchExercisesHeader";
import { exerciseTypes } from "@components/routes/AssignmentBuilder/components/exercises/components/exerciseTypes";
import { Loader } from "@components/ui/Loader";
import { FilterMatchMode } from "primereact/api";
import { Chip } from "primereact/chip";
import { Column, ColumnFilterElementTemplateOptions } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { useState } from "react";

import { useExerciseSearch } from "@/hooks/useExerciseSearch";
import { Exercise } from "@/types/exercises";

export const SearchExercises = () => {
  const { loading, error, exercises, refetch } = useExerciseSearch();
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);

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

  const exerciseTypeFilter = (options: ColumnFilterElementTemplateOptions) => {
    return (
      <Dropdown
        id="exerciseTypeFilter"
        options={exerciseTypes}
        placeholder="Select exercise type"
        optionLabel="label"
        value={exerciseTypes.find((x) => x.key === options.value)}
        onChange={(e) => {
          console.log(e.value);
          options.filterCallback(e.value.key);
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
      header={
        <SearchExercisesHeader
          selectedExercises={selectedExercises}
          setSelectedExercises={setSelectedExercises}
        />
      }
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
        showFilterOperator={false}
        showFilterMenuOptions={false}
        showFilterMatchModes={false}
        filterMenuStyle={{ width: "16rem" }}
        style={{ minWidth: "16rem" }}
        filterElement={exerciseTypeFilter}
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
      <Column
        field="htmlsrc"
        header="Preview"
        body={(data: Exercise) => {
          if (!data?.htmlsrc) {
            return null;
          }

          return <ExercisePreviewModal htmlsrc={data.htmlsrc} />;
        }}
      ></Column>
    </DataTable>
  );
};
