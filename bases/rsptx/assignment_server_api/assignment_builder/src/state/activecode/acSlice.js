/**
 * @file acSlice.js
 * @summary This file defines a slice for the active code editor
 * @description This file contains the slice for the active code editor. The slice manages the state of the active code editor.
 */
import { createSlice } from "@reduxjs/toolkit";

// create a slice for ActiveCodeEditor
// This slice must be registered with the store in store.js

/**
 * @name acSlice
 * @summary acSlice
 * @description This slice manages the state of the active code editor. It contains the following reducers:
 * - updateField
 * - setUniqueId
 * - setQpoints
 * - setLanguage
 * - setInstructions
 * - setPrefixCode
 * - setStarterCode
 * - setSuffixCode
 * It also uses the following async thunks:
 * @see saveAssignmentQuestion
 * @returns The acSlice reducer
 * @note This slice must be registered with the store in store.js
 * @memberof ActiveCodeEditor
 *
 * @typedef {Object} acSlice
 * @property {string} uniqueId - The unique identifier for the active code editor.
 * @property {number} qpoints - The number of points assigned to the active code editor.
 * @property {string} language - The programming language used in the active code editor.
 * @property {string} instructions - The instructions for the active code editor.
 * @property {string} prefix_code - The prefix code for the active code editor.
 * @property {string} starter_code - The starter code for the active code editor.
 * @property {string} suffix_code - The suffix code for the active code editor.
 */

/**
 * @type {acSlice}
 */
export const acSlice = createSlice({
  name: "acEditor",
  initialState: {
    language: "python",
    statement: "",
    prefix_code: "",
    starter_code: "",
    suffix_code: ""
  },
  reducers: {
    /**
     * @function updateField
     * @description This reducer updates a field in the active code editor
     * @param {acSlice} state - The current state of the active code editor.
     * @param {object} action - The action containing the field to update and its new value.
     * @memberof ActiveCodeEditor
     */
    updateField: (state, action) => {
      state[action.payload.field] = action.payload.newVal;
    },
    /**
     * @function setLanguage
     * @description This reducer sets the language in the active code editor
     * @param {acSlice} state - The current state of the active code editor.
     * @param {string} action - The action containing the new language value.
     * @memberof ActiveCodeEditor
     */
    setLanguage: (state, action) => {
      state.language = action.payload;
    },
    /**
     * @function setInstructions
     * @description This reducer sets the instructions in the active code editor
     * @param {acSlice} state - The current state of the active code editor.
     * @param {string} action - The action containing the new instructions value.
     * @memberof ActiveCodeEditor
     */
    setInstructions: (state, action) => {
      state.statement = action.payload;
    },
    setStatement: (state, action) => {
      state.statement = action.payload;
    },
    /**
     * @function setPrefixCode
     * @description This reducer sets the prefix code in the active code editor
     * @param {acSlice} state - The current state of the active code editor.
     * @param {string} action - The action containing the new prefix code value.
     * @memberof ActiveCodeEditor
     */
    setPrefixCode: (state, action) => {
      state.prefix_code = action.payload;
    },
    /**
     * @function setStarterCode
     * @description This reducer sets the starter code in the active code editor
     * @param {acSlice} state - The current state of the active code editor.
     * @param {string} action - The action containing the new starter code value.
     * @memberof ActiveCodeEditor
     */
    setStarterCode: (state, action) => {
      state.starter_code = action.payload;
    },
    /**
     * @function setSuffixCode
     * @description This reducer sets the suffix code in the active code editor
     * @param {acSlice} state - The current state of the active code editor.
     * @param {string} action - The action containing the new suffix code value.
     * @memberof ActiveCodeEditor
     */
    setSuffixCode: (state, action) => {
      state.suffix_code = action.payload;
    },
    setACFields: (state, action) => {
      state.language = action.payload.language;
      state.statement = action.payload.statement || action.payload.instructions;
      state.prefix_code = action.payload.prefix_code;
      state.starter_code = action.payload.starter_code;
      state.suffix_code = action.payload.suffix_code;
    }
  }
});

export const { updateField, setChapter, setACFields } = acSlice.actions;

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
/**
 * @function selectLanguage
 * @param {acSlice} state
 * @returns current language
 * @memberof ActiveCodeEditor
 *
 */
export const selectLanguage = (state) => state.acEditor.language;
/**
 * @function selectInstructions
 * @param {acSlice} state
 * @returns current instructions
 * @memberof ActiveCodeEditor
 *
 */
export const selectInstructions = (state) => state.acEditor.statement;
export const selectStatement = (state) => state.acEditor.statement;
/**
 * @function selectPrefixCode
 * @param {acSlice} state
 * @returns current prefix_code
 * @memberof ActiveCodeEditor
 *
 */
export const selectPrefixCode = (state) => state.acEditor.prefix_code;
/**
 * @function selectStarterCode
 * @param {acSlice} state
 * @returns current starter_code
 * @memberof ActiveCodeEditor
 *
 */
export const selectStarterCode = (state) => state.acEditor.starter_code;
/**
 * @function selectSuffixCode
 * @param {acSlice} state
 * @returns current suffix_code
 * @memberof ActiveCodeEditor
 *
 */
export const selectSuffixCode = (state) => state.acEditor.suffix_code;
/**
 * @function selectAll
 * @param {acSlice} state
 * @returns current acEditor
 * @memberof ActiveCodeEditor
 *
 */
export const selectAll = (state) => state.acEditor;

export default acSlice.reducer;
