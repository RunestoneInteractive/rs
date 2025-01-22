import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/store/rootReducer";
import { TableDropdownOption } from "@/types/dataset";

export interface DatasetState {
  whichToGradeOptions: TableDropdownOption[];
  autoGradeOptions: TableDropdownOption[];
}

const INITIAL_STATE: DatasetState = {
  whichToGradeOptions: [],
  autoGradeOptions: []
};

export const datasetSlice = createSlice({
  name: "dataset",
  initialState: INITIAL_STATE,
  reducers: {
    setWhichToGradeOptions: (state, action: PayloadAction<TableDropdownOption[]>) => {
      state.whichToGradeOptions = action.payload;
    },
    setAutoGradeOptions: (state, action: PayloadAction<TableDropdownOption[]>) => {
      state.autoGradeOptions = action.payload;
    }
  }
});

export const datasetActions = datasetSlice.actions;

export type DatasetActions = ActionType<typeof datasetActions>;

export const datasetSelectors = {
  getWhichToGradeOptions: (state: RootState) => state.dataset.whichToGradeOptions,
  getAutoGradeOptions: (state: RootState) => state.dataset.autoGradeOptions
};
