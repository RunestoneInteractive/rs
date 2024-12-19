import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Exercise } from "@/types/exercises";

export interface SearchExercisesState {
  selectedExercises: Exercise[];
}

const INITIAL_STATE: SearchExercisesState = {
  selectedExercises: []
};

export const searchExercisesSlice = createSlice({
  name: "searchExercises",
  initialState: INITIAL_STATE,
  reducers: {
    setSelectedExercises: (state, action: PayloadAction<Exercise[]>) => {
      state.selectedExercises = action.payload;
    }
  }
});

export const searchExercisesActions = searchExercisesSlice.actions;

export const searchExercisesSelectors = {
  getSelectedExercises: (state: RootState): Exercise[] => state.searchExercises.selectedExercises
};
export type SearchExercisesActions = ActionType<typeof searchExercisesActions>;
