import { createSlice } from "@reduxjs/toolkit";

export const acSlice = createSlice({
    name: "acEditor",
    initialState: {
        uniqueId: "activecode_1",
        qpoints: 1,
        language: "python",
        instructions: "",
        prefix_code: "",
        starter_code: "",
        suffix_code: "",
    },
    reducers: {
        updateField: (state, action) => {
            state[action.payload.field] = action.payload.newVal;
        },
    },
});

export const { updateField } = acSlice.actions;

// The function below is called a thunk and allows us to perform async logic. It
// can be dispatched like a regular action: `dispatch(incrementAsync(10))`. This
// will call the thunk with the `dispatch` function as the first argument. Async
// code can then be executed and other actions can be dispatched
// export const incrementAsync = (amount) => (dispatch) => {
//     setTimeout(() => {
//         dispatch(incrementByAmount(amount));
//     }, 1000);
// };

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
export const selectId = (state) => state.acEditor.uniqueId;
export const selectQpoints = (state) => state.acEditor.qpoints;
export const selectLanguage = (state) => state.acEditor.language;
export const selectInstructions = (state) => state.acEditor.instructions;
export const selectPrefixCode = (state) => state.acEditor.prefix_code;
export const selectStarterCode = (state) => state.acEditor.starter_code;
export const selectSuffixCode = (state) => state.acEditor.suffix_code;
export const selectAll = (state) => state.acEditor;

export default acSlice.reducer;
