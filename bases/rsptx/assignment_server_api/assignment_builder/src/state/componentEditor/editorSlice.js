import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const componentOptions = [
    {title: "ActiveCode", value: "activecode"},
    {title: "Multiple Choice", value: "multiplechoice"},
    {title: "Short Answer", value: "shortanswer"},
];

const editorSlice = createSlice({
    name: "componentEditor",
    initialState: {
        "component": null,
        "componentOptions": componentOptions,
    },
    reducers: {
        setComponent: (state, action) => {
            state.component = action.payload;
        },
    },
});

export const { setComponent } = editorSlice.actions;

export const selectComponent = (state) => state.componentEditor.component;
export const selectComponentOptions = (state) => state.componentEditor.componentOptions;

export default editorSlice.reducer;


