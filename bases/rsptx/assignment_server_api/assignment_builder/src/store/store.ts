import { configureStore } from "@reduxjs/toolkit";
import { assignmentApi } from "@store/assignment/assignmentLogic.api";
import { rootReducer, RootState } from "@store/rootReducer";

export const setupStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware({ serializableCheck: false }).concat(assignmentApi.middleware);
    }
  });
};

export const store = setupStore({});
export type AppStore = ReturnType<typeof setupStore>;
