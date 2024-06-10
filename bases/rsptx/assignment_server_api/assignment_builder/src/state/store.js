import { configureStore } from "@reduxjs/toolkit";
import acReducer from "../state/activecode/acSlice";
import assignReducer from "../state/assignment/assignSlice";
import previewReducer from "../state/preview/previewSlice";
import epReducer from "../state/epicker/ePickerSlice";
import editorReducer from "../state/componentEditor/editorSlice";
import interactiveReducer from "../state/interactive/interactiveSlice";
import mcReducer from "../state/multiplechoice/mcSlice";
import shortReducer from "../state/shortanswer/shortSlice";

export default configureStore({
    reducer: {
        acEditor: acReducer,
        assignment: assignReducer,
        preview: previewReducer,
        ePicker: epReducer,
        componentEditor: editorReducer,
        interactive: interactiveReducer,
        multiplechoice: mcReducer,
        shortanswer: shortReducer,
    },
});
