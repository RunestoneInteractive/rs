import { configureStore } from "@reduxjs/toolkit";
import { userSlice, userActions, userSelectors } from "./userLogic";

const buildStore = (preloadedState?: { user: { isAuthorized: boolean } }) =>
  configureStore({
    reducer: { user: userSlice.reducer },
    preloadedState
  });

describe("userSlice reducer", () => {
  it("returns initial state with isAuthorized true when called with undefined state", () => {
    const state = userSlice.reducer(undefined, { type: "@@INIT" });

    expect(state.isAuthorized).toBe(true);
  });

  it("sets isAuthorized to false when setIsAuthorized is dispatched with false", () => {
    const state = userSlice.reducer(undefined, userActions.setIsAuthorized(false));

    expect(state.isAuthorized).toBe(false);
  });

  it("sets isAuthorized to true when setIsAuthorized is dispatched with true", () => {
    const initialState = { isAuthorized: false };
    const state = userSlice.reducer(initialState, userActions.setIsAuthorized(true));

    expect(state.isAuthorized).toBe(true);
  });

  it("does not mutate state when same value is dispatched again", () => {
    const initialState = { isAuthorized: true };
    const state = userSlice.reducer(initialState, userActions.setIsAuthorized(true));

    expect(state.isAuthorized).toBe(true);
  });
});

describe("userActions", () => {
  it("setIsAuthorized creates an action with the correct type and payload", () => {
    const action = userActions.setIsAuthorized(false);

    expect(action.type).toBe("user/setIsAuthorized");
    expect(action.payload).toBe(false);
  });

  it("setIsAuthorized creates an action with payload true", () => {
    const action = userActions.setIsAuthorized(true);

    expect(action.payload).toBe(true);
  });
});

describe("userSelectors", () => {
  it("getIsAuthorized returns true from default state", () => {
    const store = buildStore();
    const result = userSelectors.getIsAuthorized(store.getState() as any);

    expect(result).toBe(true);
  });

  it("getIsAuthorized returns false when store has isAuthorized false", () => {
    const store = buildStore({ user: { isAuthorized: false } });
    const result = userSelectors.getIsAuthorized(store.getState() as any);

    expect(result).toBe(false);
  });

  it("getIsAuthorized reflects state after dispatching setIsAuthorized", () => {
    const store = buildStore();

    store.dispatch(userActions.setIsAuthorized(false));
    const result = userSelectors.getIsAuthorized(store.getState() as any);

    expect(result).toBe(false);
  });
});
