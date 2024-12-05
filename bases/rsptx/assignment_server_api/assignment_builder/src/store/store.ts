import { configureStore } from "@reduxjs/toolkit";
import { assignmentApi } from "@store/assignment/assignment.logic.api";
import { exercisesApi } from "@store/exercises/exercises.logic.api";
import { readingsApi } from "@store/readings/readings.logic.api";
import { rootReducer, RootState } from "@store/rootReducer";

export const setupStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware({ serializableCheck: false }).concat(
        assignmentApi.middleware,
        readingsApi.middleware,
        exercisesApi.middleware
      );
    }
  });
};

export const store = setupStore({});
export type AppStore = ReturnType<typeof setupStore>;
