import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { assignmentActions } from "@store/assignment/assignment.logic";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Nullable } from "@/types/common";
import { Exercise } from "@/types/exercises";
import { TreeNode } from "@/types/treeNode";
import { filterAvailableExercises } from "@/utils/exercise";

export interface ExercisesState {
  selectedExercises: Exercise[];
  availableExercises: TreeNode[];
  selectionAssignmentId: Nullable<number>;
}

const INITIAL_STATE: ExercisesState = {
  selectedExercises: [],
  availableExercises: [],
  selectionAssignmentId: null
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
  },
  extraReducers: (builder) => {
    builder.addCase(assignmentActions.setSelectedAssignmentId, (state, action) => {
      if (state.selectionAssignmentId !== action.payload) {
        state.selectionAssignmentId = action.payload;
        state.selectedExercises = [];
      }
    });
  }
});

export const exercisesActions = exercisesSlice.actions;

export const exercisesSelectors = {
  getSelectedExercises: (state: RootState): Exercise[] => state.exercises.selectedExercises,
  getAvailableExercises: (state: RootState): TreeNode[] => state.exercises.availableExercises
};
export type ExercisesActions = ActionType<typeof exercisesActions>;
