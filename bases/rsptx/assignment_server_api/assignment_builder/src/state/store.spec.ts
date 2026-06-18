import { setupStore, store } from "./store";

describe("setupStore", () => {
  it("creates a store with the expected top-level state keys", () => {
    const testStore = setupStore({});
    const state = testStore.getState();

    expect(state).toHaveProperty("acEditor");
    expect(state).toHaveProperty("assignment");
    expect(state).toHaveProperty("preview");
    expect(state).toHaveProperty("ePicker");
    expect(state).toHaveProperty("componentEditor");
    expect(state).toHaveProperty("interactive");
    expect(state).toHaveProperty("multiplechoice");
    expect(state).toHaveProperty("shortanswer");
    expect(state).toHaveProperty("student");
    expect(state).toHaveProperty("assignmentTemp");
    expect(state).toHaveProperty("user");
    expect(state).toHaveProperty("readings");
    expect(state).toHaveProperty("exercises");
    expect(state).toHaveProperty("chooseExercises");
    expect(state).toHaveProperty("searchExercises");
    expect(state).toHaveProperty("dataset");
    expect(state).toHaveProperty("assignmentExercise");
  });

  it("creates a store with RTK Query API reducer keys present", () => {
    const testStore = setupStore({});
    const state = testStore.getState();

    expect(state).toHaveProperty("assignmentAPI");
    expect(state).toHaveProperty("assignmentExerciseAPI");
    expect(state).toHaveProperty("readingsAPI");
    expect(state).toHaveProperty("exercisesAPI");
    expect(state).toHaveProperty("datasetApi");
    expect(state).toHaveProperty("datafileAPI");
    expect(state).toHaveProperty("graderApi");
  });

  it("returns a store with a dispatch function and getState function", () => {
    const testStore = setupStore({});

    expect(typeof testStore.dispatch).toBe("function");
    expect(typeof testStore.getState).toBe("function");
  });

  it("applies preloaded state to the store", () => {
    const testStore = setupStore({
      assignmentTemp: { selectedAssignmentId: 42 }
    });

    expect(testStore.getState().assignmentTemp.selectedAssignmentId).toBe(42);
  });

  it("creates independent stores on each call", () => {
    const storeA = setupStore({});
    const storeB = setupStore({});

    expect(storeA).not.toBe(storeB);
  });
});

describe("store singleton", () => {
  it("is defined and has a getState function", () => {
    expect(store).toBeDefined();
    expect(typeof store.getState).toBe("function");
  });

  it("exposes the same top-level keys as a store created with setupStore", () => {
    const singletonState = store.getState();
    const freshStore = setupStore({});
    const freshState = freshStore.getState();

    expect(Object.keys(singletonState).sort()).toEqual(Object.keys(freshState).sort());
  });
});
