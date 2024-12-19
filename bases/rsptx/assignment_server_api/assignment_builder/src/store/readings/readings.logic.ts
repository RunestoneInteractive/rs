import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { TreeNode } from "primereact/treenode";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Exercise } from "@/types/exercises";
import { removeChildrenWithoutTitleImmutable } from "@/utils/exercise";

export interface ReadingsState {
  selectedReadings: Exercise[];
  availableReadings: TreeNode[];
}

const INITIAL_STATE: ReadingsState = {
  selectedReadings: [],
  availableReadings: []
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
  }
});

export const readingsActions = readingsSlice.actions;

export const readingsSelectors = {
  getSelectedReadings: (state: RootState): Exercise[] => state.readings.selectedReadings,
  getAvailableReadings: (state: RootState): TreeNode[] => state.readings.availableReadings
};
export type ReadingsActions = ActionType<typeof readingsActions>;
