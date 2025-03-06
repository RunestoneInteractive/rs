import { WithDragLogicProps } from "@components/ui/EditableTable/hoc/withDragLogic";

import { Exercise } from "@/types/exercises";

// View mode type
export type ViewMode = "list" | "browse" | "search" | "create" | "edit";

// Props for the wrapped AssignmentExercisesComponent
export type AssignmentExercisesComponentProps = WithDragLogicProps;

// Define ViewModeSetter to handle the type mismatch
export type ViewModeSetter = (mode: ViewMode) => void;

// Define the setCurrentEditExercise type
export type SetCurrentEditExercise = (exercise: Exercise | null) => void;

// Define the MouseUpHandler type
export type MouseUpHandler = () => void;
