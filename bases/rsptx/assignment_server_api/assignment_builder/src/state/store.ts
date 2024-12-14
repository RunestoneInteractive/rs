import {
  combineReducers,
  configureStore,
  createListenerMiddleware,
  isAnyOf
} from "@reduxjs/toolkit";
import { assignmentActions, assignmentSlice } from "@store/assignment/assignment.logic";
import { assignmentApi } from "@store/assignment/assignment.logic.api.js";
import { exercisesSlice } from "@store/exercises/exercises.logic";
import { exercisesApi } from "@store/exercises/exercises.logic.api";
import { readingsSlice } from "@store/readings/readings.logic";
import { readingsApi } from "@store/readings/readings.logic.api";
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
  assignmentTemp: assignmentSlice.reducer,
  user: userSlice.reducer,
  readings: readingsSlice.reducer,
  exercises: exercisesSlice.reducer,
  [readingsApi.reducerPath]: readingsApi.reducer,
  [exercisesApi.reducerPath]: exercisesApi.reducer
};

export type RootState = StateType<typeof reducersMap>;

const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  matcher: isAnyOf(assignmentActions.setSelectedAssignment),
  effect: async (_, api) => {
    const debounceTime = 500;
    const state = api.getState() as RootState;

    const { selectedAssignment } = state.assignmentTemp;

    api.cancelActiveListeners();

    await api.delay(debounceTime);

    if (!!selectedAssignment) {
      await api.dispatch(assignmentApi.endpoints.updateAssignment.initiate(selectedAssignment));
    }
  }
});

export const setupStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: combineReducers(reducersMap),
    preloadedState,
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware({ serializableCheck: false }).concat(
        assignmentApi.middleware,
        readingsApi.middleware,
        exercisesApi.middleware,
        listenerMiddleware.middleware
      );
    }
  });
};

export const store = setupStore({});
