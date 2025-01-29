import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import sortBy from "lodash/sortBy";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Exercise } from "@/types/exercises";
import { getExercisesWithoutReadings } from "@/utils/exercise";

export interface AssignmentExerciseState {
  assignmentExercises: Exercise[];
}

const INITIAL_STATE: AssignmentExerciseState = {
  assignmentExercises: []
};

export const assignmentExerciseSlice = createSlice({
  name: "assignmentExercise",
  initialState: INITIAL_STATE,
  reducers: {
    setAssignmentExercises: (state, action: PayloadAction<Exercise[]>) => {
      state.assignmentExercises = action.payload;
    }
  }
});

export const assignmentExerciseActions = assignmentExerciseSlice.actions;

export const getAssignmentExercisesSelector = createSelector(
  (state: RootState) => state.assignmentExercise.assignmentExercises,
  (assignmentExercises) => getExercisesWithoutReadings(assignmentExercises)
);

export const getAssignmentReadingsSelector = createSelector(
  (state: RootState) => state.assignmentExercise.assignmentExercises,
  (assignmentExercises) =>
    sortBy(
      assignmentExercises.filter((ex) => ex.reading_assignment),
      (exercise) => exercise.sorting_priority
    )
);

export const assignmentExerciseSelectors = {
  getAssignmentExercises: getAssignmentExercisesSelector,
  getAssignmentReadings: getAssignmentReadingsSelector
};

export type AssignmentExerciseActions = ActionType<typeof assignmentExerciseActions>;
