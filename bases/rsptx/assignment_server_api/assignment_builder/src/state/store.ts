import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { assignmentApi } from "@store/assignment/assignmentLogic.api.js";
import { userSlice } from "@store/user/userLogic.js";
import { StateType } from "typesafe-actions";

import acReducer from "../state/activecode/acSlice";
import assignReducer from "../state/assignment/assignSlice";
import editorReducer from "../state/componentEditor/editorSlice";
import epReducer from "../state/epicker/ePickerSlice";
import interactiveReducer from "../state/interactive/interactiveSlice";
import mcReducer from "../state/multiplechoice/mcSlice";
import previewReducer from "../state/preview/previewSlice";
import shortReducer from "../state/shortanswer/shortSlice";
import studentReducer from "../state/student/studentSlice";

const reducersMap = {
  acEditor: acReducer,
  assignment: assignReducer,
  preview: previewReducer,
  ePicker: epReducer,
  componentEditor: editorReducer,
  interactive: interactiveReducer,
  multiplechoice: mcReducer,
  shortanswer: shortReducer,
  student: studentReducer,
  [assignmentApi.reducerPath]: assignmentApi.reducer,
  user: userSlice.reducer
};

export type RootState = StateType<typeof reducersMap>;

export const setupStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: combineReducers(reducersMap),
    preloadedState,
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware({ serializableCheck: false }).concat(assignmentApi.middleware);
    }
  });
};

export const store = setupStore({});
