import { configureStore } from "@reduxjs/toolkit";
import acReducer from "../state/activecode/acSlice";
import assignReducer from "../state/assignment/assignSlice";
import previewReducer from "../state/preview/previewSlice";
import epReducer from "../state/epicker/ePickerSlice";
export default configureStore({
    reducer: {
        acEditor: acReducer,
        assignment: assignReducer,
        preview: previewReducer,
        ePicker: epReducer,
    },
});
