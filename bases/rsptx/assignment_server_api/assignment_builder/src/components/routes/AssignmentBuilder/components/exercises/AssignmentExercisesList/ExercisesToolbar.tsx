import { SearchInput } from "@components/ui/SearchInput";
import { Button } from "primereact/button";
import { Menu } from "primereact/menu";
import { MenuItem } from "primereact/menuitem";
import { useRef } from "react";

import { Exercise } from "@/types/exercises";

import { ViewModeSetter } from "./types";

interface ExercisesToolbarProps {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  selectedExercises: Exercise[];
  handleRemoveSelected: () => void;
  setViewMode: ViewModeSetter;
  setResetExerciseForm: (reset: boolean) => void;
}

export const ExercisesToolbar = ({
  globalFilter,
  setGlobalFilter,
  selectedExercises,
  handleRemoveSelected,
  setViewMode,
  setResetExerciseForm
}: ExercisesToolbarProps) => {
  const menuRef = useRef<Menu>(null);

  const addMenuItems: MenuItem[] = [
    {
      label: "Browse Chapter Exercises",
      icon: "pi pi-book",
      command: () => setViewMode("browse")
    },
    {
      label: "Search Exercises",
      icon: "pi pi-search",
      command: () => setViewMode("search")
    },
    {
      label: "Create New Exercise",
      icon: "pi pi-plus",
      command: () => {
        setResetExerciseForm(true);
        setViewMode("create");
      }
    }
  ];

  return (
    <div className="flex justify-content-between align-items-center mb-3">
      <div className="flex-grow-1">
        <SearchInput
          value={globalFilter}
          onChange={setGlobalFilter}
          placeholder="Search exercises..."
          className="w-full"
        />
      </div>
      <div className="flex gap-2 ml-3">
        {selectedExercises.length > 0 && (
          <Button
            icon="pi pi-trash"
            severity="danger"
            tooltip="Remove Selected"
            tooltipOptions={{ position: "top" }}
            onClick={handleRemoveSelected}
          />
        )}
        <Button
          label="Add Exercise"
          icon="pi pi-plus"
          onClick={(e) => menuRef.current?.toggle(e)}
          severity="success"
        />
        <Menu model={addMenuItems} popup ref={menuRef} />
      </div>
    </div>
  );
};
