import { configureStore } from "@reduxjs/toolkit";
import { rootReducer } from "@store/rootReducer";

describe("rootReducer", () => {
  it("returns a defined initial state when called with undefined state and an empty action", () => {
    const state = rootReducer(undefined, { type: "@@INIT" });

    expect(state).toBeDefined();
  });

  it("initial state contains all expected top-level slice keys", () => {
    const state = rootReducer(undefined, { type: "@@INIT" });

    expect(state).toHaveProperty("user");
    expect(state).toHaveProperty("assignment");
    expect(state).toHaveProperty("readings");
    expect(state).toHaveProperty("exercises");
    expect(state).toHaveProperty("chooseExercises");
    expect(state).toHaveProperty("searchExercises");
    expect(state).toHaveProperty("dataset");
    expect(state).toHaveProperty("assignmentExercise");
  });

  it("user slice initializes with isAuthorized set to true", () => {
    const state = rootReducer(undefined, { type: "@@INIT" });

    expect(state.user).toEqual({ isAuthorized: true });
  });

  it("assignment slice initializes with selectedAssignmentId set to null", () => {
    const state = rootReducer(undefined, { type: "@@INIT" });

    expect(state.assignment).toEqual({ selectedAssignmentId: null });
  });

  it("exercises slice initializes with empty arrays for selectedExercises and availableExercises", () => {
    const state = rootReducer(undefined, { type: "@@INIT" });

    expect(state.exercises.selectedExercises).toEqual([]);
    expect(state.exercises.availableExercises).toEqual([]);
  });

  it("unknown actions do not mutate state", () => {
    const stateBefore = rootReducer(undefined, { type: "@@INIT" });
    const stateAfter = rootReducer(stateBefore, { type: "UNKNOWN_ACTION_XYZ" });

    expect(stateAfter).toEqual(stateBefore);
  });

  it("can be used with configureStore without throwing", () => {
    expect(() => configureStore({ reducer: rootReducer })).not.toThrow();
  });

  it("store created from rootReducer has the expected initial state shape", () => {
    const store = configureStore({ reducer: rootReducer });
    const state = store.getState();

    expect(typeof state.user.isAuthorized).toBe("boolean");
    expect(state.assignment.selectedAssignmentId).toBeNull();
  });
});
