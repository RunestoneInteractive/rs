import { BreadCrumb } from "primereact/breadcrumb";

import { Exercise } from "@/types/exercises";

import { ViewMode, ViewModeSetter } from "./types";

interface ExercisesBreadcrumbProps {
  viewMode: ViewMode;
  setViewMode: ViewModeSetter;
  currentEditExercise: Exercise | null;
}

export const ExercisesBreadcrumb = ({
  viewMode,
  setViewMode,
  currentEditExercise
}: ExercisesBreadcrumbProps) => {
  const breadcrumbItems = [
    { label: "Assignment Exercises", command: () => setViewMode("list") },
    ...(viewMode !== "list"
      ? [
          {
            label:
              viewMode === "browse"
                ? "Browse Chapters"
                : viewMode === "search"
                  ? "Search Exercises"
                  : viewMode === "edit" && currentEditExercise
                    ? `Edit Poll: ${currentEditExercise.name || "Unnamed"}`
                    : "Create Exercise"
          }
        ]
      : [])
  ];

  const breadcrumbHome = { icon: "pi pi-home", command: () => setViewMode("list") };

  return <BreadCrumb model={breadcrumbItems} home={breadcrumbHome} className="mb-3" />;
};
