import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { setSelectedNodes } from "../epicker/ePickerSlice";
import toast from "react-hot-toast";


// thunks can take a single argument. If you need to pass multiple values, pass an object
export const fetchAssignments = createAsyncThunk(
    "assignment/fetchAssignments",
    async () => {
        const response = await fetch("/assignment/instructor/assignments");
        const data = await response.json();
        //dispatch(updateField({ field: "exercises", newVal: data }));
        return data.detail;
    }
);

export const createAssignment = createAsyncThunk(
    "assignment/createAssignment",
    // incoming is an object that combines the activecode data and the assignment data and the preview_src
    async (assignData, { dispatch, getState }) => {
        let assignmentId = 0;
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
    async (exercise, { getState }) => {
        let state = getState();
        let idx = state.assignment.exercises.findIndex((ex) => ex.id === exercise.id);
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
    async (exercises, { getState }) => {
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
    async (exercises, { getState }) => {
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
    async (assignment, { getState }) => {
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
        due: defaultDeadline,
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
                state.due = action.payload;
                return;
            }
            state.due = action.payload.toISOString().replace('Z', '')
        },
        setExercises: (state, action) => {
            state.exercises = action.payload;
        },
        addExercise: (state, action) => {
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
            let exercise = action.payload;
            state.exercises = state.exercises.filter((ex) => ex.id !== exercise.id);
        },
        reorderExercise: (state, action) => {
            let exOrder = action.payload.exOrder;
            // reorder the state.assignment.exercises array to match the order of the ids in exercises
            state.exercises = exOrder.map(id => state.exercises.find(ex => ex.id === id));
            // now renumber the sort_order field in exercises
            state.exercises.forEach((ex, idx) => {
                ex.sorting_priority = idx;
            });
        }
    },
    extraReducers(builder) {
        builder
            .addCase(fetchAssignments.fulfilled, (state, action) => {
                state.all_assignments = action.payload.assignments;
            })
            .addCase(fetchAssignments.rejected, (state, action) => {
                console.log("fetchAssignments rejected");
            })
            .addCase(fetchAssignmentQuestions.fulfilled, (state, action) => {
                state.exercises = action.payload.exercises;
            })
            .addCase(fetchAssignmentQuestions.rejected, (state, action) => {
                console.log("fetchAssignmentQuestions rejected");
            })
            .addCase(sendDeleteExercises.fulfilled, (state, action) => {
                console.log("deleteExercises fulfilled");
            })
            .addCase(sendDeleteExercises.rejected, (state, action) => {
                console.log("deleteExercises rejected");
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
    reorderExercise,
    deleteExercises,
    updateExercise,
    addAssignment,
} = assignSlice.actions;

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
// Note: the state is the global state, followed by the name of the slice (see state.js)
// followed by the name of the field in the slice
export const selectId = (state) => state.assignment.id;
export const selectName = (state) => state.assignment.name;
export const selectDesc = (state) => state.assignment.desc;
export const selectDue = (state) => state.assignment.due;
export const selectPoints = (state) => state.assignment.points;
export const selectExercises = (state) => state.assignment.exercises;
export const selectAll = (state) => state.assignment;

export default assignSlice.reducer;
