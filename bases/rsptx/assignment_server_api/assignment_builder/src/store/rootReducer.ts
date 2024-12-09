import { combineReducers } from "@reduxjs/toolkit";
import { assignmentSlice } from "@store/assignment/assignment.logic";
import { assignmentApi } from "@store/assignment/assignment.logic.api";
import { exercisesSlice } from "@store/exercises/exercises.logic";
import { exercisesApi } from "@store/exercises/exercises.logic.api";
import { readingsSlice } from "@store/readings/readings.logic";
import { readingsApi } from "@store/readings/readings.logic.api";
import { userSlice } from "@store/user/userLogic";
import { StateType } from "typesafe-actions";

const reducersMap = {
  user: userSlice.reducer,
  assignment: assignmentSlice.reducer,
  readings: readingsSlice.reducer,
  exercises: exercisesSlice.reducer,
  [assignmentApi.reducerPath]: assignmentApi.reducer,
  [readingsApi.reducerPath]: readingsApi.reducer,
  [exercisesApi.reducerPath]: exercisesApi.reducer
};

export const rootReducer = combineReducers(reducersMap);

export type RootState = StateType<typeof reducersMap>;
//
// export type RootAction = UserActions | AssignmentActions;
