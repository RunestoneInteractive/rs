import { combineReducers } from "@reduxjs/toolkit";
import { AssignmentActions, assignmentSlice } from "@store/assignment/assignment.logic";
import { assignmentApi } from "@store/assignment/assignment.logic.api";
import { readingsApi } from "@store/readings/readings.logic.api";
import { UserActions, userSlice } from "@store/user/userLogic";
import { StateType } from "typesafe-actions";

const reducersMap = {
  user: userSlice.reducer,
  assignment: assignmentSlice.reducer,
  [assignmentApi.reducerPath]: assignmentApi.reducer,
  [readingsApi.reducerPath]: readingsApi.reducer
};

export const rootReducer = combineReducers(reducersMap);

export type RootState = StateType<typeof reducersMap>;
//
// export type RootAction = UserActions | AssignmentActions;
