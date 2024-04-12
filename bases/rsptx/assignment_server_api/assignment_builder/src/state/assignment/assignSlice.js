/**
 * @fileoverview This file contains the Redux slice for the assignment builder.
 * This is a good place to start if you are looking to understand how the assignment builder
 * interacts with the server.
 * 
 * To see the major data, jump to the `assignSlice` object.
 * 
 * The first part of this file defines a number of "thunks" which are async functions that can be dispatched
 * to the Redux store. These thunks are used to interact with the server. for example:
 * - `fetchAssignments` is used to get the list of assignments from the server
 * - `createAssignment` is used to create a new assignment on the server
 * - `fetchAssignmentQuestions` is used to get the list of questions associated with an assignment
 * - `sendExercise` is used to add a question to an assignment
 * - `sendDeleteExercises` is used to remove questions from an assignment
 * - `reorderAssignmentQuestions` is used to reorder the questions in an assignment
 * - `sendAssignmentUpdate` is used to update the assignment details
 * - `searchForQuestions` is used to search for questions in the question bank
 * 
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { setSelectedNodes } from "../epicker/ePickerSlice";
import toast from "react-hot-toast";


// thunks can take a single argument. If you need to pass multiple values, pass an object
// thunks can optionally take a second argument which is an object that contains the getState and dispatch
// functions.  You can call getState to get a reference to the Redux store.



/**
 * @function fetchAssignments
 * @description This function is called to initialize the list of assignments.
 * @param {object} getState - the getState function from the Redux store
 * @returns {Promise} - a promise that resolves to the list of assignments
 * 
 * When the promise is resolved, the list of assignments is added to the Redux store.
 * Any further actions that need to be taken after the assignments are fetched can be done in the
 * fetchAssignments.fulfilled case of the builder object in the extraReducers method.
 */
export const fetchAssignments = createAsyncThunk(
    "assignment/fetchAssignments",
    async ({ getState }) => {
        const response = await fetch("/assignment/instructor/assignments");
        const data = await response.json();
        let state = getState();
        //dispatch(updateField({ field: "exercises", newVal: data }));
        if (!response.ok) {
            console.warn("Error fetching assignments");
            if (response.status === 401) {
                console.warn("Unauthorized to fetch assignments");
                state.assignment.isAuthorized = false;
                return;
            }
        }
        return data.detail;
    }
);

/**
 * @function createAssignment
 * @param {object} assignData - an object that contains the data for the new assignment
 * @param {object} dispatch - the dispatch function from the Redux store
 * @description This function is called when the user creates a new assignment.
 * 
 * Upon success, the function dispatches the setId action to set the id of the new assignment.
 * It also returns a Promise.  When the promise is result any actions that need to be taken after the
 * assignment is created can be done in the createAssignment.fulfilled case of the builder object 
 * in the extraReducers method.
 */
export const createAssignment = createAsyncThunk(
    "assignment/createAssignment",
    // incoming is an object that combines the activecode data and the assignment data and the preview_src
    async (assignData, { dispatch }) => {
        let jsheaders = new Headers({
            "Content-type": "application/json; charset=utf-8",
            Accept: "application/json",
        });
        let body = {
            name: assignData.name,
            description: assignData.description,
            duedate: assignData.duedate,
            points: assignData.points,
            kind: "quickcode",
        };
        let data = {
            body: JSON.stringify(body),
            headers: jsheaders,
            method: "POST",
        };
        let resp = await fetch("/assignment/instructor/new_assignment", data);
        if (!resp.ok) {
            console.warn("Error creating assignment");
            if (resp.status === 422) {
                console.warn("Missing data for creating assignment");
                /* The JON response from the server looks like this:
                {
                    "detail": [
                        {
                            "type": "int_parsing",
                            "loc": [
                                "body",
                                "points"
                            ],
                            "msg": "Input should be a valid integer, unable to parse string as an integer",
                            "input": "",
                            "url": "https://errors.pydantic.dev/2.6/v/int_parsing"
                        }
                    ]
                }
                */
                let result = await resp.json();
                toast(
                    `Error ${result.detail[0].msg} for input ${result.detail[0].loc}`,
                    { duration: 5000 }
                );
            } else {
                let result = await resp.json();
                console.error(result.detail)
                toast("Error creating assignment", {
                    icon: "🔥",
                    duration: 5000,
                });
            }

            return;
        }
        toast("Assignment created", { icon: "👍" });
        let result = await resp.json();
        // The result will contain the id assigned to the new assignment
        dispatch(setId(result.detail.id));
        // todo: Add the assignment to the list of all_assignments
        assignData.id = result.detail.id;
        dispatch(addAssignment(assignData));
    })

export const fetchAssignmentQuestions = createAsyncThunk(
    "assignment/fetchAssignmentQuestions",
    async (assignmentId, { getState, dispatch }) => {
        const response = await fetch("/assignment/instructor/assignment_questions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ assignment: assignmentId }),
        });
        const data = await response.json();
        let store = getState();
        let selectedNodes = {};
        // Not super efficient, but we need to set the selectedNodes for the ePicker
        // maybe better to include more question data with the assignment_questions then we 
        // would not have to search.
        for (let ch of store.ePicker.nodes) {
            for (let sc of ch.children) {
                for (let q of sc.children) {
                    if (data.detail.exercises.find((d) => d.question_id === q.data.id)) {
                        selectedNodes[q.key] = { checked: true, partialChecked: false };
                        selectedNodes["c:" + q.data.chapter] = { checked: false, partialChecked: true };
                        selectedNodes["s:" + q.data.subchapter] = { checked: false, partialChecked: true };
                    }
                }
            }
        }
        dispatch(setSelectedNodes(selectedNodes));
        return data.detail;
    }
);

export const sendExercise = createAsyncThunk(
    "assignment/sendExercise",
    async (exercise) => {
        const response = await fetch("/assignment/instructor/update_assignment_question", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(exercise),
        });
        const data = await response.json();
        return data.detail;
    }
);

export const sendDeleteExercises = createAsyncThunk(
    "assignment/sendDeleteExercises",
    async (exercises) => {
        exercises = exercises.map((ex) => ex.id);
        console.log("deleteExercises", exercises)
        const response = await fetch("/assignment/instructor/remove_assignment_questions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(exercises),
        });
        const data = await response.json();
        return data.detail;
    }
);

export const reorderAssignmentQuestions = createAsyncThunk(
    "assignment/reorderAssignmentQuestions",
    async (exercises) => {
        // exercises is an array of assignment_question ids
        const response = await fetch("/assignment/instructor/reorder_assignment_questions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(exercises),
        });
        const data = await response.json();
        return data.detail;
    }
);

export const sendAssignmentUpdate = createAsyncThunk(
    "assignment/sendAssignmentUpdate",
    // todo missing released, duedate, and from_source
    async (assignment) => {
        const response = await fetch("/assignment/instructor/update_assignment", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(assignment),
        });
        if (!response.ok) {
            let err = await response.json();
            console.error("Error updating assignment", err.detail);
            return;
        }
        const data = await response.json();
        return data.detail;
    }
);

export const searchForQuestions = createAsyncThunk(
    "assignment/searchForQuestions",
    async (searchData) => {
        const response = await fetch("/assignment/instructor/search_questions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(searchData),
        });
        const data = await response.json();
        return data.detail;
    }
);

let cDate = new Date();
let epoch = cDate.getTime();
epoch = epoch + 60 * 60 * 24 * 7 * 1000;
cDate = new Date(epoch);
let defaultDeadline = `${cDate.getFullYear()}-${`${cDate.getMonth() + 1
    }`.padStart(2, 0)}-${`${cDate.getDate()}`.padStart(
        2,
        0
    )}T${`${cDate.getHours()}`.padStart(2, 0)}:${`${cDate.getMinutes()}`.padStart(
        2,
        0
    )}:00.0`;
// old     

// create a slice for Assignments
// This slice must be registered with the store in store.js
export const assignSlice = createSlice({
    name: "assignment",
    initialState: {
        id: 0,
        name: "",
        desc: "",
        duedate: defaultDeadline,
        points: 1,
        visible: true,
        is_peer: false,
        is_timed: false,
        nofeedback: true,
        nopause: true,
        time_limit: null,
        peer_async_visible: false,
        kind: "regular", // (regular, peer, timed)
        exercises: [],
        all_assignments: [],
        search_results: [],
        question_count: 0,
        isAuthorized: true,
    },
    reducers: {
        updateField: (state, action) => {
            state[action.payload.field] = action.payload.newVal;
        },
        setId: (state, action) => {
            state.id = action.payload;
        },
        setName: (state, action) => {
            state.name = action.payload;
        },
        setDesc: (state, action) => {
            state.desc = action.payload;
        },
        setDue: (state, action) => {
            // action.payload is a Date object coming from the date picker or a string from the server
            // convert it to a string and remove the Z because we don't expect timezone information
            if (typeof action.payload === "string") {
                state.duedate = action.payload;
                return;
            }
            state.duedate = action.payload.toISOString().replace('Z', '')
        },
        setVisible: (state, action) => {
            state.visible = action.payload;
        },
        setIsPeer: (state, action) => {
            state.is_peer = action.payload;
        },
        setIsTimed: (state, action) => {
            state.is_timed = action.payload;
        },
        setNoFeedback: (state, action) => {
            state.nofeedback = action.payload;
        },
        setNoPause: (state, action) => {
            state.nopause = action.payload;
        },
        setTimeLimit: (state, action) => {
            state.time_limit = action.payload;
        },
        setPeerAsyncVisible: (state, action) => {
            state.peer_async_visible = action.payload;
        },
        setFromSource: (state, action) => {
            state.from_source = action.payload;
        },
        setReleased: (state, action) => {
            state.released = action.payload;
        },
        setExercises: (state, action) => {
            state.exercises = action.payload;
        },
        addExercise: (state, action) => {
            console.log("addExercise", action.payload)
            state.exercises.push(action.payload);
        },
        addAssignment: (state, action) => {
            state.all_assignments.push(action.payload);
        },
        setPoints: (state, action) => {
            state.points = Number(action.payload);
        },
        updateExercise: (state, action) => {
            let idx = state.exercises.findIndex((ex) => ex.id === action.payload.id);
            state.exercises[idx] = action.payload.exercise;
        },
        deleteExercises: (state, action) => {
            let exercises = action.payload;
            console.log("deleteExercises", exercises)
            exercises = exercises.map((ex) => ex.id);
            state.exercises = state.exercises.filter((ex) => !exercises.includes(ex.id));
        },
        reorderExercise: (state, action) => {
            let exOrder = action.payload.exOrder;
            // reorder the state.assignment.exercises array to match the order of the ids in exercises
            state.exercises = exOrder.map(id => state.exercises.find(ex => ex.id === id));
            // now renumber the sort_order field in exercises
            state.exercises.forEach((ex, idx) => {
                ex.sorting_priority = idx;
            });
        },
        setSearchResults: (state, action) => {
            state.search_results = action.payload;
        },
        incrementQuestionCount: (state) => {
            state.question_count += 1;
        },
        sumPoints: (state, action) => {
            let total = 0;
            for (let ex of state.exercises) {
                total += ex.points;
            }
            if (action.payload && action.payload.adjustment) {
                total += action.payload.adjustment;
            }
            state.points = total;
        }
    },
    extraReducers(builder) {
        /* eslint-disable */
        builder
            .addCase(fetchAssignments.fulfilled, (state, action) => {
                state.all_assignments = action.payload.assignments;
            })
            .addCase(fetchAssignments.rejected, (state, action) => {
                console.log("fetchAssignments rejected");
            })
            .addCase(fetchAssignmentQuestions.fulfilled, (state, action) => {
                state.exercises = action.payload.exercises;
                let total = 0;
                for (let ex of state.exercises) {
                    total += ex.points;
                }
                state.points = total;
                console.log("fetchAssignmentQuestions fulfilled");
            })
            .addCase(fetchAssignmentQuestions.rejected, (state, action) => {
                console.log("fetchAssignmentQuestions rejected");
            })
            .addCase(sendDeleteExercises.fulfilled, (state, action) => {
                console.log("senddeleteExercises fulfilled");
            })
            .addCase(sendDeleteExercises.rejected, (state, action) => {
                console.log("sendDeleteExercises rejected");
            })
            .addCase(reorderAssignmentQuestions.fulfilled, (state, action) => {
                console.log("reorderAssignmentQuestions fulfilled");
            })
            .addCase(reorderAssignmentQuestions.rejected, (state, action) => {
                console.log("reorderAssignmentQuestions rejected");
            })
            .addCase(createAssignment.fulfilled, (state, action) => {
                console.log("createAssignment fulfilled");
            })
            .addCase(createAssignment.rejected, (state, action) => {
                console.log("createAssignment rejected");
            })
            .addCase(sendAssignmentUpdate.fulfilled, (state, action) => {
                console.log("sendAssignmentUpdate fulfilled");
            })
            .addCase(sendAssignmentUpdate.rejected, (state, action) => {
                console.log("sendAssignmentUpdate rejected");
            })
            .addCase(searchForQuestions.fulfilled, (state, action) => {
                console.log("searchForQuestions fulfilled");
                state.search_results = action.payload.questions;
            })
            .addCase(searchForQuestions.rejected, (state, action) => {
                console.log("searchForQuestions rejected");
            })
        /* eslint-enable */
    },

});

// export the reducers
export const {
    updateField,
    addExercise,
    setName,
    setDesc,
    setDue,
    setId,
    setPoints,
    setVisible,
    setIsPeer,
    setIsTimed,
    setNoFeedback,
    setNoPause,
    setTimeLimit,
    setPeerAsyncVisible,
    setFromSource,
    setReleased,
    reorderExercise,
    deleteExercises,
    updateExercise,
    addAssignment,
    incrementQuestionCount,
    sumPoints,
} = assignSlice.actions;

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
// Note: the state is the global state, followed by the name of the slice (see state.js)
// followed by the name of the field in the slice
export const selectId = (state) => state.assignment.id;
export const selectName = (state) => state.assignment.name;
export const selectDesc = (state) => state.assignment.desc;
export const selectDue = (state) => state.assignment.duedate;
export const selectPoints = (state) => state.assignment.points;
export const selectExercises = (state) => state.assignment.exercises;
export const selectAll = (state) => state.assignment;
export const selectAssignmentId = (state) => state.assignment.id;
export const selectVisible = (state) => state.assignment.visible;
export const selectIsPeer = (state) => state.assignment.is_peer;
export const selectIsTimed = (state) => state.assignment.is_timed;
export const selectNoFeedback = (state) => state.assignment.nofeedback;
export const selectNoPause = (state) => state.assignment.nopause;
export const selectTimeLimit = (state) => state.assignment.time_limit;
export const selectPeerAsyncVisible = (state) => state.assignment.peer_async_visible;
export const selectSearchResults = (state) => state.assignment.search_results;
export const selectQuestionCount = (state) => state.assignment.question_count;
export const selectAllAssignments = (state) => state.assignment.all_assignments;
export const selectIsAuthorized = (state) => state.assignment.isAuthorized;
export default assignSlice.reducer;
