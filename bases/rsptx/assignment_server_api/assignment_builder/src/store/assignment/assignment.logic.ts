import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Assignment } from "@/types/assignment";
import { Optional } from "@/types/common";

export interface AssignmentState {
  selectedAssignment?: Assignment;
}

const INITIAL_STATE: AssignmentState = {};

export const assignmentSlice = createSlice({
  name: "assignment",
  initialState: INITIAL_STATE,
  reducers: {
    setSelectedAssignment: (state, action: PayloadAction<Assignment | undefined>) => {
      state.selectedAssignment = action.payload;
    }
  }
});

export const assignmentActions = assignmentSlice.actions;

export const assignmentSelectors = {
  getSelectedAssignment: (state: RootState): Optional<Assignment> =>
    state.assignmentTemp.selectedAssignment
};
export type AssignmentActions = ActionType<typeof assignmentActions>;
