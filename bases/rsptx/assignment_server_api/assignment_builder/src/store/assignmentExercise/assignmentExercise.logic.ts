import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import sortBy from "lodash/sortBy";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Nullable } from "@/types/common";
import { Exercise } from "@/types/exercises";
import { getExercisesWithoutReadings } from "@/utils/exercise";

export interface AssignmentExerciseState {
  assignmentExercises: Exercise[];
  forAssignmentId: Nullable<number>;
}

const INITIAL_STATE: AssignmentExerciseState = {
  assignmentExercises: [],
  forAssignmentId: null
};

export const assignmentExerciseSlice = createSlice({
  name: "assignmentExercise",
  initialState: INITIAL_STATE,
  reducers: {
    setAssignmentExercises: (state, action: PayloadAction<Exercise[]>) => {
      state.assignmentExercises = action.payload;
    },
    setAssignmentExercisesForAssignment: (
      state,
      action: PayloadAction<{ assignmentId: number; exercises: Exercise[] }>
    ) => {
      state.assignmentExercises = action.payload.exercises;
      state.forAssignmentId = action.payload.assignmentId;
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
  getAssignmentReadings: getAssignmentReadingsSelector,
  getExercisesForAssignmentId: (state: RootState): Nullable<number> =>
    state.assignmentExercise.forAssignmentId
};

export type AssignmentExerciseActions = ActionType<typeof assignmentExerciseActions>;
