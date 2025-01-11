import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Nullable } from "@/types/common";

export interface AssignmentState {
  selectedAssignmentId: Nullable<number>;
}

const INITIAL_STATE: AssignmentState = {
  selectedAssignmentId: null
};

export const assignmentSlice = createSlice({
  name: "assignment",
  initialState: INITIAL_STATE,
  reducers: {
    setSelectedAssignmentId: (state, action: PayloadAction<Nullable<number>>) => {
      state.selectedAssignmentId = action.payload;
    }
  }
});

export const assignmentActions = assignmentSlice.actions;

export const assignmentSelectors = {
  getSelectedAssignmentId: (state: RootState): Nullable<number> =>
    state.assignmentTemp.selectedAssignmentId
};
export type AssignmentActions = ActionType<typeof assignmentActions>;
