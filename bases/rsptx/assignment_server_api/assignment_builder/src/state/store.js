import { configureStore } from "@reduxjs/toolkit";
import acReducer from "../state/activecode/acSlice";
import assignReducer from "../state/assignment/assignSlice";
import previewReducer from "../state/preview/previewSlice";

export default configureStore({
    reducer: {
        acEditor: acReducer,
        assignment: assignReducer,
        preview: previewReducer,
    },
});
