import { configureStore } from "@reduxjs/toolkit";
import acReducer from "../state/activecode/acSlice";
import assignReducer from "../state/assignment/assignSlice";

export default configureStore({
    reducer: {
        acEditor: acReducer,
        assignment: assignReducer,
    },
});
