/**
 * @file acSlice.js
 * @summary This file defines a slice for the multiple choice editor
 * @description This file contains the slice for the multiple choice editor.
 */
import { createSlice } from "@reduxjs/toolkit";

export const mcSlice = createSlice({
  name: "multiplechoice",
  initialState: {
    statement: "",
    optionList: [{ choice: "", feedback: "", correct: false }]
  },
  reducers: {
    /**
     * @function updateField
     * @description This reducer updates a field in the multiple choice editor
     * @param {mcSlice} state - The current state of the multiple choice editor.
     * @param {object} action - The action containing the field to update and its new value.
     * @memberof MultipleChoiceEditor
     */
    updateField: (state, action) => {
      state[action.payload.field] = action.payload.value;
    },
    /**
     * @function addOption
     * @description This reducer adds an option to the multiple choice editor
     * @param {mcSlice} state - The current state of the multiple choice editor.
     * @memberof MultipleChoiceEditor
     */
    addOption: (state) => {
      state.optionList.push({ choice: "", feedback: "", correct: false });
    },
    /**
     * @function removeOption
     * @description This reducer removes an option from the multiple choice editor
     * @param {mcSlice} state - The current state of the multiple choice editor.
     * @param {object} action - The action containing the index of the option to remove.
     * @memberof MultipleChoiceEditor
     */
    removeOption: (state, action) => {
      state.optionList.splice(action.payload, 1);
    },
    /**
     * @function updateOption
     * @description This reducer updates an option in the multiple choice editor
     * @param {mcSlice} state - The current state of the multiple choice editor.
     * @param {object} action - The action containing the index of the option to update and its new value.
     * @memberof MultipleChoiceEditor
     */
    updateOption: (state, action) => {
      state.optionList[action.payload.index][action.payload.field] = action.payload.value;
    },
    setOptionList: (state, action) => {
      state.optionList = action.payload;
    },
    setStatement: (state, action) => {
      state.statement = action.payload;
    },
    setMCFields: (state, action) => {
      state.statement = action.payload.statement;
      state.optionList = action.payload.optionList;
    }
  }
});

export const {
  updateField,
  addOption,
  removeOption,
  updateOption,
  setOptionList,
  setStatement,
  setMCFields
} = mcSlice.actions;

export const selectStatement = (state) => state.multiplechoice.statement;
export const selectOptionList = (state) => state.multiplechoice.optionList;

export default mcSlice.reducer;
