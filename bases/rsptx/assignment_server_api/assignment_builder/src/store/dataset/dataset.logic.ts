import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/store/rootReducer";
import { TableDropdownOption, SectionOption } from "@/types/dataset";

export interface DatasetState {
  whichToGradeOptions: TableDropdownOption[];
  autoGradeOptions: TableDropdownOption[];
  languageOptions: TableDropdownOption[];
  questionTypeOptions: TableDropdownOption[];
  sections: SectionOption[];
}

const INITIAL_STATE: DatasetState = {
  whichToGradeOptions: [],
  autoGradeOptions: [],
  languageOptions: [],
  questionTypeOptions: [],
  sections: []
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
    },
    setLanguageOptions: (state, action: PayloadAction<TableDropdownOption[]>) => {
      state.languageOptions = action.payload;
    },
    setQuestionTypeOptions: (state, action: PayloadAction<TableDropdownOption[]>) => {
      state.questionTypeOptions = action.payload;
    },
    setSections: (state, action: PayloadAction<SectionOption[]>) => {
      state.sections = action.payload;
    }
  }
});

export const datasetActions = datasetSlice.actions;

export type DatasetActions = ActionType<typeof datasetActions>;

export const datasetSelectors = {
  getWhichToGradeOptions: (state: RootState) => state.dataset.whichToGradeOptions,
  getAutoGradeOptions: (state: RootState) => state.dataset.autoGradeOptions,
  getLanguageOptions: (state: RootState) => state.dataset.languageOptions,
  getQuestionTypeOptions: (state: RootState) => state.dataset.questionTypeOptions,
  getSections: (state: RootState) => state.dataset.sections
};
