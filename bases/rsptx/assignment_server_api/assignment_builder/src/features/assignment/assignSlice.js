import { createSlice } from "@reduxjs/toolkit";

let cDate = new Date();
let epoch = cDate.getTime();
epoch = epoch + 60 * 60 * 24 * 7 * 1000;
cDate = new Date(epoch);
let defaultDeadline = `${cDate.getFullYear()}-${`${
    cDate.getMonth() + 1
}`.padStart(2, 0)}-${`${cDate.getDate()}`.padStart(
    2,
    0
)}T${`${cDate.getHours()}`.padStart(
    2,
    0
)}:${`${cDate.getMinutes()}`.padStart(2, 0)}`;

export const assignSlice = createSlice({
    name: "assignment",
    initialState: {
        name: "",
        desc: "",
        due: defaultDeadline,
        points: 1,
        exercises: [],
    },
    reducers: {
        updateField: (state, action) => {
            state[action.payload.field] = action.payload.newVal;
        },
        addExercise: (state, action) => {
            state.exercises.push(action.payload);
        },
        incrementPoints: (state, action) => {
            state.points += action.payload;
        },
    },
});

export const { updateField, addExercise, incrementPoints } =
    assignSlice.actions;

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
