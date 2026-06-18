import { configureStore } from "@reduxjs/toolkit";
import { assignmentSlice, assignmentActions, assignmentSelectors } from "./assignment.logic";

const buildStore = (preloaded?: { assignmentTemp: { selectedAssignmentId: number | null } }) =>
  configureStore({
    reducer: { assignmentTemp: assignmentSlice.reducer },
    preloadedState: preloaded
  });

describe("assignmentSlice reducer", () => {
  it("returns initial state with selectedAssignmentId null when no action dispatched", () => {
    const store = buildStore();
    expect(store.getState().assignmentTemp.selectedAssignmentId).toBeNull();
  });

  it("sets selectedAssignmentId to a numeric value when setSelectedAssignmentId is dispatched with a number", () => {
    const store = buildStore();

    store.dispatch(assignmentActions.setSelectedAssignmentId(42));

    expect(store.getState().assignmentTemp.selectedAssignmentId).toBe(42);
  });

  it("sets selectedAssignmentId back to null when setSelectedAssignmentId is dispatched with null", () => {
    const store = buildStore({ assignmentTemp: { selectedAssignmentId: 99 } });

    store.dispatch(assignmentActions.setSelectedAssignmentId(null));

    expect(store.getState().assignmentTemp.selectedAssignmentId).toBeNull();
  });

  it("overwrites a previously set id when setSelectedAssignmentId is dispatched again", () => {
    const store = buildStore();

    store.dispatch(assignmentActions.setSelectedAssignmentId(1));
    store.dispatch(assignmentActions.setSelectedAssignmentId(2));

    expect(store.getState().assignmentTemp.selectedAssignmentId).toBe(2);
  });

  it("sets selectedAssignmentId to zero when dispatched with 0", () => {
    const store = buildStore();

    store.dispatch(assignmentActions.setSelectedAssignmentId(0));

    expect(store.getState().assignmentTemp.selectedAssignmentId).toBe(0);
  });
});

describe("assignmentSelectors.getSelectedAssignmentId", () => {
  it("returns null when selectedAssignmentId has not been set", () => {
    const state = { assignmentTemp: { selectedAssignmentId: null } } as any;

    expect(assignmentSelectors.getSelectedAssignmentId(state)).toBeNull();
  });

  it("returns the numeric id stored in assignmentTemp", () => {
    const state = { assignmentTemp: { selectedAssignmentId: 7 } } as any;

    expect(assignmentSelectors.getSelectedAssignmentId(state)).toBe(7);
  });

  it("reads from assignmentTemp key, not from any other state key", () => {
    const state = {
      assignmentTemp: { selectedAssignmentId: 55 },
      other: { selectedAssignmentId: 999 }
    } as any;

    expect(assignmentSelectors.getSelectedAssignmentId(state)).toBe(55);
  });
});
