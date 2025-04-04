import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// create a slice for our preview
// This slice must be registered with the store in store.js
export const previewSlice = createSlice({
  name: "preview",
  initialState: {
    code: ""
  },
  reducers: {
    setCode: (state, action) => {
      state.code = action.payload;
    }
  }
});

// export our reducer actions
export const { setCode } = previewSlice.actions;

// export our selectors
export const selectCode = (state) => {
  return state.preview.code;
};

// export our reducer
export default previewSlice.reducer;
