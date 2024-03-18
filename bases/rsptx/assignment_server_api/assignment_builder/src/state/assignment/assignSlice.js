import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

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

export const fetchAssignmentQuestions = createAsyncThunk(
    "assignment/fetchAssignmentQuestions",
    async (assignmentId) => {
        const response = await fetch("/assignment/instructor/assignment_questions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ assignment: assignmentId }),
        });
        const data = await response.json();
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
    )}:00.0Z`;
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
        exercises: [],
        all_assignments: [],
    },
    reducers: {
        updateField: (state, action) => {
            state[action.payload.field] = action.payload.newVal;
        },
        setName: (state, action) => {
            state.name = action.payload;
        },
        setDesc: (state, action) => {
            state.desc = action.payload;
        },
        setDue: (state, action) => {
            state.due = action.payload;
        },
        addExercise: (state, action) => {
            state.exercises.push(action.payload);
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
    },

});

export const { updateField, addExercise, setName, setDesc, setDue, setPoints, reorderExercise, deleteExercises, updateExercise } =
    assignSlice.actions;

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
export const selectName = (state) => state.assignment.name;
export const selectDesc = (state) => state.assignment.desc;
export const selectDue = (state) => state.assignment.due;
export const selectPoints = (state) => state.assignment.points;
export const selectExercises = (state) => state.assignment.exercises;
export const selectAll = (state) => state.assignment;

export default assignSlice.reducer;
