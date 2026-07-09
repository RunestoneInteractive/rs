import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { assignmentActions } from "@store/assignment/assignment.logic";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Nullable } from "@/types/common";
import { Exercise } from "@/types/exercises";
import { TreeNode } from "@/types/treeNode";
import { removeChildrenWithoutTitleImmutable } from "@/utils/exercise";

export interface ReadingsState {
  selectedReadings: Exercise[];
  availableReadings: TreeNode[];
  selectionAssignmentId: Nullable<number>;
}

const INITIAL_STATE: ReadingsState = {
  selectedReadings: [],
  availableReadings: [],
  selectionAssignmentId: null
};

export const readingsSlice = createSlice({
  name: "readings",
  initialState: INITIAL_STATE,
  reducers: {
    setSelectedReadings: (state, action: PayloadAction<Exercise[]>) => {
      state.selectedReadings = action.payload;
    },
    setAvailableReadings: (state, action: PayloadAction<TreeNode[]>) => {
      state.availableReadings = removeChildrenWithoutTitleImmutable(action.payload);
    }
  },
  extraReducers: (builder) => {
    builder.addCase(assignmentActions.setSelectedAssignmentId, (state, action) => {
      if (state.selectionAssignmentId !== action.payload) {
        state.selectionAssignmentId = action.payload;
        state.selectedReadings = [];
      }
    });
  }
});

export const readingsActions = readingsSlice.actions;

export const readingsSelectors = {
  getSelectedReadings: (state: RootState): Exercise[] => state.readings.selectedReadings,
  getAvailableReadings: (state: RootState): TreeNode[] => state.readings.availableReadings
};
export type ReadingsActions = ActionType<typeof readingsActions>;
