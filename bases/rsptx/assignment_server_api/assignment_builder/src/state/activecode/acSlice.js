import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
    createActiveCodeTemplate,
    renderRunestoneComponent,
} from "../../componentFuncs.js";

export const saveAssignmentQuestion = createAsyncThunk(
    "acEditor/saveAssignmentQuestion",
    // incoming is an object that combines the activecode data and the assignment data and the preview_src
    async (incoming) => {
        let preview_src = incoming.previewSrc;
        let assignData = incoming.assignData;
        let acData = incoming.acData;
        let assignmentId = 0;
        let questionId = 0;
        let jsheaders = new Headers({
            "Content-type": "application/json; charset=utf-8",
            Accept: "application/json",
        });
        let body = {
            name: assignData.name,
            description: assignData.desc,
            duedate: assignData.due,
            points: assignData.points,
            kind: "quickcode",
        };
        let data = {
            body: JSON.stringify(body),
            headers: jsheaders,
            method: "POST",
        };
        let resp = await fetch("/assignment/instructor/new_assignment", data);
        let result = await resp.json();
        if (result.detail.status === "success") {
            console.log("Assignment created");
            assignmentId = result.detail.id;
        }

        // Now add the question
        // these names match the database columns
        body = {
            name: acData.uniqueId,
            question: acData,
            question_type: "activecode",
            source: JSON.stringify(assignData),
            htmlsrc: preview_src,
            question_json: JSON.stringify({ ...acData, ...assignData }),
        };
        data = {
            body: JSON.stringify(body),
            headers: jsheaders,
            method: "POST",
        };
        resp = await fetch("/assignment/instructor/new_question", data);
        result = await resp.json();
        if (result.detail.status === "success") {
            console.log("Question created");
            questionId = result.detail.id;
        }

        //finally add the question to the assignment
        body = {
            assignment_id: assignmentId,
            question_id: questionId,
            points: assignData.points,
        };
        data = {
            body: JSON.stringify(body),
            headers: jsheaders,
            method: "POST",
        };
        resp = await fetch("/assignment/instructor/new_assignment_q", data);
        result = await resp.json();
        if (result.detail.status === "success") {
            console.log("Question added to assignment");
        }
    }
);

// create a slice for ActiveCodeEditor
// This slice must be registered with the store in store.js
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
        setUniqueId: (state, action) => {
            state.uniqueId = action.payload;
        },
        setQpoints: (state, action) => {
            state.qpoints = Number(action.payload);
        },
        setLanguage: (state, action) => {
            state.language = action.payload;
        },
        setInstructions: (state, action) => {
            state.instructions = action.payload;
        },
        setPrefixCode: (state, action) => {
            state.prefix_code = action.payload;
        },
        setStarterCode: (state, action) => {
            state.starter_code = action.payload;
        },
        setSuffixCode: (state, action) => {
            state.suffix_code = action.payload;
        },
    },
    extraReducers(builder) {
        builder
            .addCase(saveAssignmentQuestion.fulfilled, (state, action) => {
                console.log("Question saved");
            })
            .addCase(saveAssignmentQuestion.rejected, (state, action) => {
                console.log("Question save failed");
            });
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
