import { setupStore, store } from "@store/store";

describe("setupStore", () => {
  it("creates a store with a defined getState function", () => {
    const s = setupStore();
    expect(s.getState).toBeDefined();
    expect(typeof s.getState).toBe("function");
  });

  it("creates a store with a defined dispatch function", () => {
    const s = setupStore();
    expect(s.dispatch).toBeDefined();
    expect(typeof s.dispatch).toBe("function");
  });

  it("returns initial state containing all expected top-level slices", () => {
    const s = setupStore();
    const state = s.getState();
    expect(state).toHaveProperty("user");
    expect(state).toHaveProperty("assignment");
    expect(state).toHaveProperty("readings");
    expect(state).toHaveProperty("exercises");
    expect(state).toHaveProperty("chooseExercises");
    expect(state).toHaveProperty("searchExercises");
    expect(state).toHaveProperty("dataset");
    expect(state).toHaveProperty("assignmentExercise");
  });

  it("applies preloaded state when provided", () => {
    const s = setupStore({ user: { loggedIn: false, userData: null } as never });
    const state = s.getState();
    expect((state.user as { loggedIn: boolean }).loggedIn).toBe(false);
  });

  it("returns a new store instance on every call", () => {
    const s1 = setupStore();
    const s2 = setupStore();
    expect(s1).not.toBe(s2);
  });
});

describe("store (default singleton)", () => {
  it("is defined and has getState", () => {
    expect(store).toBeDefined();
    expect(typeof store.getState).toBe("function");
  });

  it("has a non-null initial state", () => {
    expect(store.getState()).not.toBeNull();
  });
});
