import { configureStore } from "@reduxjs/toolkit";
import acReducer from "../features/activecode/acSlice";
import assignReducer from "../features/assignment/assignSlice";

export default configureStore({
    reducer: {
        acEditor: acReducer,
        assignment: assignReducer,
    },
});
