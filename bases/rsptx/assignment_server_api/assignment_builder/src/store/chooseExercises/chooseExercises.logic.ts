import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/state/store";
import { Exercise } from "@/types/exercises";
import { SelectedKey } from "@/types/treeNode";
import { getExercisesWithoutReadings } from "@/utils/exercise";

export interface ChooseExercisesState {
  selectedKeys: Record<string, SelectedKey>;
  selectedExercises: Exercise[];
  exercisesToAdd: Exercise[];
  exercisesToRemove: Exercise[];
}

const INITIAL_STATE: ChooseExercisesState = {
  selectedKeys: {},
  selectedExercises: [],
  exercisesToAdd: [],
  exercisesToRemove: []
};

export const chooseExercisesSlice = createSlice({
  name: "chooseExercises",
  initialState: INITIAL_STATE,
  reducers: {
    setSelectedExercises: (state, action: PayloadAction<Exercise[]>) => {
      state.selectedExercises = getExercisesWithoutReadings(action.payload);
    },
    setExercisesToAdd: (state, action: PayloadAction<Exercise[]>) => {
      state.exercisesToAdd = action.payload;
    },
    setExercisesToRemove: (state, action: PayloadAction<Exercise[]>) => {
      state.exercisesToRemove = action.payload;
    },
    setSelectedKeys: (state, action: PayloadAction<Record<string, SelectedKey>>) => {
      state.selectedKeys = action.payload;
    },
    resetSelections: (state) => {
      state.exercisesToAdd = INITIAL_STATE.exercisesToAdd;
      state.exercisesToRemove = INITIAL_STATE.exercisesToRemove;
    }
  }
});

export const chooseExercisesActions = chooseExercisesSlice.actions;

export const chooseExercisesSelectors = {
  getSelectedExercises: (state: RootState): Exercise[] => state.chooseExercises.selectedExercises,
  getExercisesToAdd: (state: RootState): Exercise[] => state.chooseExercises.exercisesToAdd,
  getExercisesToRemove: (state: RootState): Exercise[] => state.chooseExercises.exercisesToRemove,
  getSelectedKeys: (state: RootState): Record<string, SelectedKey> =>
    state.chooseExercises.selectedKeys
};
export type ChooseExercisesActions = ActionType<typeof chooseExercisesActions>;
