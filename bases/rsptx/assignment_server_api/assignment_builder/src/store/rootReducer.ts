import { combineReducers } from "@reduxjs/toolkit";
import { assignmentSlice } from "@store/assignment/assignment.logic";
import { assignmentApi } from "@store/assignment/assignment.logic.api";
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
import { userSlice } from "@store/user/userLogic";
import { StateType } from "typesafe-actions";

const reducersMap = {
  user: userSlice.reducer,
  assignment: assignmentSlice.reducer,
  readings: readingsSlice.reducer,
  exercises: exercisesSlice.reducer,
  chooseExercises: chooseExercisesSlice.reducer,
  searchExercises: searchExercisesSlice.reducer,
  dataset: datasetSlice.reducer,
  assignmentExercise: assignmentExerciseSlice.reducer,
  [assignmentApi.reducerPath]: assignmentApi.reducer,
  [assignmentExerciseApi.reducerPath]: assignmentExerciseApi.reducer,
  [readingsApi.reducerPath]: readingsApi.reducer,
  [exercisesApi.reducerPath]: exercisesApi.reducer,
  [datasetApi.reducerPath]: datasetApi.reducer
};

export const rootReducer = combineReducers(reducersMap);

export type RootState = StateType<typeof reducersMap>;
//
// export type RootAction = UserActions | AssignmentActions;
