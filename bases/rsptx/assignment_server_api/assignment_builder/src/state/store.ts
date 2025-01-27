import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { assignmentSlice } from "@store/assignment/assignment.logic";
import { assignmentApi } from "@store/assignment/assignment.logic.api.js";
import { assignmentExerciseSlice } from "@store/assignmentExercise/assignmentExercise.logic";
import { assignmentExerciseApi } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { chooseExercisesSlice } from "@store/chooseExercises/chooseExercises.logic";
import { datasetSlice } from "@store/dataset/dataset.logic";
import { datasetApi } from "@store/dataset/dataset.logic.api";
import { exercisesSlice } from "@store/exercises/exercises.logic";
import { exercisesApi } from "@store/exercises/exercises.logic.api";
import { readingsSlice } from "@store/readings/readings.logic";
import { readingsApi } from "@store/readings/readings.logic.api";
import { searchExercisesSlice } from "@store/searchExercises/searchExercises.logic";
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
  [assignmentExerciseApi.reducerPath]: assignmentExerciseApi.reducer,
  assignmentTemp: assignmentSlice.reducer,
  user: userSlice.reducer,
  readings: readingsSlice.reducer,
  exercises: exercisesSlice.reducer,
  chooseExercises: chooseExercisesSlice.reducer,
  searchExercises: searchExercisesSlice.reducer,
  dataset: datasetSlice.reducer,
  assignmentExercise: assignmentExerciseSlice.reducer,
  [readingsApi.reducerPath]: readingsApi.reducer,
  [exercisesApi.reducerPath]: exercisesApi.reducer,
  [datasetApi.reducerPath]: datasetApi.reducer
};

export type RootState = StateType<typeof reducersMap>;

export const setupStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: combineReducers(reducersMap),
    preloadedState,
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware({ serializableCheck: false }).concat(
        assignmentApi.middleware,
        assignmentExerciseApi.middleware,
        readingsApi.middleware,
        exercisesApi.middleware,
        datasetApi.middleware
      );
    }
  });
};

export const store = setupStore({});
