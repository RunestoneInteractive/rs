import { configureStore } from "@reduxjs/toolkit";

import acReducer from "../state/activecode/acSlice";
import assignReducer from "../state/assignment/assignSlice";
import editorReducer from "../state/componentEditor/editorSlice";
import epReducer from "../state/epicker/ePickerSlice";
import interactiveReducer from "../state/interactive/interactiveSlice";
import mcReducer from "../state/multiplechoice/mcSlice";
import previewReducer from "../state/preview/previewSlice";
import shortReducer from "../state/shortanswer/shortSlice";
import studentReducer from "../state/student/studentSlice";

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
    student: studentReducer,
  },
});
