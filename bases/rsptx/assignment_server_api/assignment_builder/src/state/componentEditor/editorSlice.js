import { createSlice } from "@reduxjs/toolkit";

// Note the values of the componentOptions array in this snippet should
// match the question_types used in the database. See admin.py for the canonical list and  values.
//
const componentOptions = [
  { title: "ActiveCode", value: "activecode" },
  { title: "Multiple Choice", value: "mchoice" },
  { title: "Short Answer", value: "shortanswer" }
];

const editorSlice = createSlice({
  name: "componentEditor",
  initialState: {
    component: null,
    componentOptions: componentOptions
  },
  reducers: {
    setComponent: (state, action) => {
      state.component = action.payload;
    }
  }
});

export const { setComponent } = editorSlice.actions;

export const selectComponent = (state) => state.componentEditor.component;
export const selectComponentOptions = (state) => state.componentEditor.componentOptions;

export default editorSlice.reducer;
