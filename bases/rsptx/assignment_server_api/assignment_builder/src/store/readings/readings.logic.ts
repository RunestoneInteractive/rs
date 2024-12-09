import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Exercise } from "@/types/exercises";

export interface ReadingsState {
  selectedReadings: Exercise[];
}

const INITIAL_STATE: ReadingsState = {
  selectedReadings: []
};

export const readingsSlice = createSlice({
  name: "readings",
  initialState: INITIAL_STATE,
  reducers: {
    setSelectedReadings: (state, action: PayloadAction<Exercise[]>) => {
      state.selectedReadings = action.payload;
    }
  }
});

export const readingsActions = readingsSlice.actions;

export const readingsSelectors = {
  getSelectedReadings: (state: RootState): Exercise[] => state.readings.selectedReadings
};
export type ReadingsActions = ActionType<typeof readingsActions>;
