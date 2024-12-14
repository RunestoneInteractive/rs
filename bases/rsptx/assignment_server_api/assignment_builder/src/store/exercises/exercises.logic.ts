import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Exercise } from "@/types/exercises";

export interface ExercisesState {
  selectedExercises: Exercise[];
}

const INITIAL_STATE: ExercisesState = {
  selectedExercises: []
};

export const exercisesSlice = createSlice({
  name: "exercises",
  initialState: INITIAL_STATE,
  reducers: {
    setSelectedExercises: (state, action: PayloadAction<Exercise[]>) => {
      state.selectedExercises = action.payload;
    }
  }
});

export const exercisesActions = exercisesSlice.actions;

export const exercisesSelectors = {
  getSelectedExercises: (state: RootState): Exercise[] => state.exercises.selectedExercises
};
export type ExercisesActions = ActionType<typeof exercisesActions>;
