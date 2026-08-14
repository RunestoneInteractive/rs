import { WithDragLogicProps } from "@components/ui/EditableTable/hoc/withDragLogic";

import { Exercise } from "@/types/exercises";

// View mode type
export type ViewMode = "list" | "browse" | "search" | "create" | "edit";

// Props for the wrapped AssignmentExercisesComponent
export type AssignmentExercisesComponentProps = WithDragLogicProps;

// Options forwarded to the router so the view mode is reflected in the URL.
// `exerciseId` is a question_id, which is what /exercises/edit/<id> carries.
export interface ViewModeOptions {
  exerciseType?: string;
  exerciseSubType?: string;
  exerciseId?: string;
  step?: number;
}

// Define ViewModeSetter to handle the type mismatch
export type ViewModeSetter = (mode: ViewMode, options?: ViewModeOptions) => void;

// Define the setCurrentEditExercise type
export type SetCurrentEditExercise = (exercise: Exercise | null) => void;

// Define the MouseUpHandler type
export type MouseUpHandler = () => void;
