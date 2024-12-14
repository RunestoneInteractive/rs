import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ActionType } from "typesafe-actions";

import { RootState } from "@/store/rootReducer";

export interface UserState {
  isAuthorized: boolean;
}

const INITIAL_STATE: UserState = {
  isAuthorized: true
};

export const userSlice = createSlice({
  name: "user",
  initialState: INITIAL_STATE,
  reducers: {
    setIsAuthorized: (state, action: PayloadAction<boolean>) => {
      state.isAuthorized = action.payload;
    }
  }
});

export const userActions = userSlice.actions;

export type UserActions = ActionType<typeof userActions>;

export const userSelectors = {
  getIsAuthorized: (state: RootState) => state.user.isAuthorized
};
