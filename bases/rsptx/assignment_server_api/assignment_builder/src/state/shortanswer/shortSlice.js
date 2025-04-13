/**
 * @file acSlice.js
 * @summary This file defines a slice for the multiple choice editor
 * @description This file contains the slice for the multiple choice editor.
 */
import { createSlice } from "@reduxjs/toolkit";

export const shortSlice = createSlice({
  name: "shortanswer",
  initialState: {
    statement: "",
    attachment: false
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
     * @function setStatement
     * @description This reducer sets the problem statement
     * @param {mcSlice} state - The current state of the shortanswer editor.
     * @memberof ShortAnswerEditor
     */
    setStatement: (state, action) => {
      state.statement = action.payload;
    },
    setAttachment: (state, action) => {
      state.attachment = action.payload;
    }
  }
});

export const { updateField, setStatement, setAttachment } = shortSlice.actions;

export const selectStatement = (state) => state.shortanswer.statement;
export const selectAttachment = (state) => state.shortanswer.attachment;

export default shortSlice.reducer;
