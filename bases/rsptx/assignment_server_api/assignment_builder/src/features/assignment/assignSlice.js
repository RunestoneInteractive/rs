import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchAssignments = createAsyncThunk(
    "assignment/fetchAssignments",
    async () => {
        const response = await fetch("/assignment/instructor/assignments");
        const data = await response.json();
        //dispatch(updateField({ field: "exercises", newVal: data }));
        return data.detail;
    }
);

let cDate = new Date();
let epoch = cDate.getTime();
epoch = epoch + 60 * 60 * 24 * 7 * 1000;
cDate = new Date(epoch);
let defaultDeadline = `${cDate.getFullYear()}-${`${
    cDate.getMonth() + 1
}`.padStart(2, 0)}-${`${cDate.getDate()}`.padStart(
    2,
    0
)}T${`${cDate.getHours()}`.padStart(2, 0)}:${`${cDate.getMinutes()}`.padStart(
    2,
    0
)}`;

export const assignSlice = createSlice({
    name: "assignment",
    initialState: {
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
    },
    extraReducers(builder) {
        builder.addCase(fetchAssignments.fulfilled, (state, action) => {
            state.all_assignments = action.payload.assignments;
        }).addCase(fetchAssignments.rejected, (state, action) => {
            console.log("fetchAssignments rejected");
        });
    },
});

export const { updateField, addExercise, setPoints } = assignSlice.actions;

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
export const selectName = (state) => state.assignment.name;
export const selectDesc = (state) => state.assignment.desc;
export const selectDue = (state) => state.assignment.due;
export const selectPoints = (state) => state.assignment.points;
export const selectExercises = (state) => state.assignment.exercises;
export const selectAll = (state) => state.assignment;

export default assignSlice.reducer;
