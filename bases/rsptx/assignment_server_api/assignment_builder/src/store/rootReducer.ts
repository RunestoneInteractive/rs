import { combineReducers } from "@reduxjs/toolkit";
import { AssignmentActions, assignmentSlice } from "@store/assignment/assignmentLogic";
import { assignmentApi } from "@store/assignment/assignmentLogic.api";
import { UserActions, userSlice } from "@store/user/userLogic";
import { StateType } from "typesafe-actions";

const reducersMap = {
  user: userSlice.reducer,
  assignment: assignmentSlice.reducer,
  [assignmentApi.reducerPath]: assignmentApi.reducer
};

export const rootReducer = combineReducers(reducersMap);

export type RootState = StateType<typeof reducersMap>;
//
// export type RootAction = UserActions | AssignmentActions;
