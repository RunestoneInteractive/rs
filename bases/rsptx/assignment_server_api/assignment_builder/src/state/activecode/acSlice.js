/**
 * @file acSlice.js
 * @summary This file defines a slice for the active code editor
 * @description This file contains the slice for the active code editor. The slice manages the state of the active code editor.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import toast from "react-hot-toast";
import { addExercise, selectPoints, setPoints } from "../assignment/assignSlice.js";

/**
 * @function saveAssignmentQuestion
 * @summary saveAssignmentQuestion
 * @description This thunk saves the activecode question to the database as well as adding it to the current assignment
 * @param {object} incoming - an object that combines the activecode data and the assignment data and the preview_src
 * @returns {Promise} a promise that resolves to the result of the fetch -- Any thrown by the thunk
 * will result in the promise being rejected and the error will be logged by the builder in extraReducers.
 * @memberof ActiveCodeEditor
 * 
 */
export const saveAssignmentQuestion = createAsyncThunk(
    "acEditor/saveAssignmentQuestion",
    // incoming is an object that combines the activecode data and the assignment data and the preview_src
    async (incoming, { getState, dispatch }) => {
        let store = getState();
        let preview_src = incoming.previewSrc;
        let assignData = incoming.assignData;
        let acData = incoming.acData;
        let assignmentId = assignData.id;
        let questionId = 0;
        // todo 
        let jsheaders = new Headers({
            "Content-type": "application/json; charset=utf-8",
            Accept: "application/json",
        });
        // Now add the question
        // these names match the database columns
        let body = {
            name: acData.uniqueId,
            question: acData,
            question_type: "activecode",
            source: JSON.stringify(assignData),
            htmlsrc: preview_src,
            question_json: JSON.stringify({ ...acData, ...assignData }),
        };
        if (acData.suffix_code) {
            body.autograde = 'unittest'
        } else {
            body.autograde = 'manual'
        }
        let data = {
            body: JSON.stringify(body),
            headers: jsheaders,
            method: "POST",
        };
        let resp = await fetch("/assignment/instructor/new_question", data);
        if (!resp.ok) {
            let result = await resp.json();
            console.log("Failed to create question", result.detail);
            toast("Failed to create question - Most likely a name conflict", { icon: "🚫" })
            return;
        }
        let result = await resp.json();
        if (result.detail.status === "success") {
            console.log("Question created");
            questionId = result.detail.id;

        }
        let aqBody = {
            assignment_id: assignmentId,
            question_id: questionId,
            points: acData.qpoints,
        };
        let allEx = store.assignment.exercises
        let clen = allEx.length;
        aqBody.which_to_grade = clen ? allEx[allEx.length - 1].which_to_grade : "best_answer";
        aqBody.autograde = body.autograde;
        aqBody.qnumber = body.name;
        aqBody.id = questionId;
        try {
            dispatch(addExercise(aqBody))
        } catch (e) {
            console.error(e);
        }
        dispatch(setPoints(selectPoints(store) + acData.qpoints));
        //finally add the question to the assignment
        // not sure if this is neeeded after the previous dispatch...
        data = {
            body: JSON.stringify(aqBody),
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
 */
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
        /* eslint-disable */
        builder
            .addCase(saveAssignmentQuestion.fulfilled, (state, action) => {
                console.log("Question saved");
            })
            .addCase(saveAssignmentQuestion.rejected, (state, action) => {
                console.log("Question save failed", action.error.message);
            });
        /* eslint-enable */
    },
});

export const { updateField } = acSlice.actions;

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
