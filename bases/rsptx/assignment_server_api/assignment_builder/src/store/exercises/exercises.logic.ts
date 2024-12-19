import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { TreeNode } from "primereact/treenode";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Exercise } from "@/types/exercises";
import { filterAvailableExercises } from "@/utils/exercise";

export interface ExercisesState {
  selectedExercises: Exercise[];
  availableExercises: TreeNode[];
}

const INITIAL_STATE: ExercisesState = {
  selectedExercises: [],
  availableExercises: []
};

export const exercisesSlice = createSlice({
  name: "exercises",
  initialState: INITIAL_STATE,
  reducers: {
    setSelectedExercises: (state, action: PayloadAction<Exercise[]>) => {
      state.selectedExercises = action.payload;
    },
    setAvailableExercises: (state, action: PayloadAction<TreeNode[]>) => {
      state.availableExercises = filterAvailableExercises(action.payload);
    }
  }
});

export const exercisesActions = exercisesSlice.actions;

export const exercisesSelectors = {
  getSelectedExercises: (state: RootState): Exercise[] => state.exercises.selectedExercises,
  getAvailableExercises: (state: RootState): TreeNode[] => state.exercises.availableExercises
};
export type ExercisesActions = ActionType<typeof exercisesActions>;
