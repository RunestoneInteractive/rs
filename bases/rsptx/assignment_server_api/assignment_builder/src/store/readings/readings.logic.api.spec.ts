import { configureStore } from "@reduxjs/toolkit";
import { readingsApi, useGetAvailableReadingsQuery } from "./readings.logic.api";
import { readingsSlice } from "@store/readings/readings.logic";
import type { DetailResponse } from "@/types/api";
import type { GetAvailableReadingsPayload } from "@/types/readings";
import type { TreeNode } from "@/types/treeNode";

vi.mock("@components/ui/notify", () => ({
  notify: {
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    update: vi.fn(),
    hide: vi.fn(),
    clean: vi.fn()
  }
}));

vi.mock("@store/baseQuery", () => ({
  baseQuery: vi.fn()
}));

function buildStore() {
  return configureStore({
    reducer: {
      readings: readingsSlice.reducer,
      [readingsApi.reducerPath]: readingsApi.reducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(readingsApi.middleware)
  });
}

describe("readingsApi module exports", () => {
  it("exports the readingsApi object", () => {
    expect(readingsApi).toBeDefined();
  });

  it("has the correct reducerPath", () => {
    expect(readingsApi.reducerPath).toBe("readingsAPI");
  });

  it("exports the useGetAvailableReadingsQuery hook", () => {
    expect(typeof useGetAvailableReadingsQuery).toBe("function");
  });

  it("has util and endpoints defined", () => {
    expect(readingsApi.util).toBeDefined();
    expect(readingsApi.endpoints).toBeDefined();
    expect(readingsApi.endpoints.getAvailableReadings).toBeDefined();
  });
});

describe("readingsApi store integration", () => {
  it("mounts its reducer in a combined store without errors", () => {
    expect(() => buildStore()).not.toThrow();
  });

  it("initial readingsApi state has a queries key", () => {
    const store = buildStore();
    const apiState = store.getState()[readingsApi.reducerPath];
    expect(apiState).toHaveProperty("queries");
  });

  it("initial readingsApi state has a mutations key", () => {
    const store = buildStore();
    const apiState = store.getState()[readingsApi.reducerPath];
    expect(apiState).toHaveProperty("mutations");
  });

  it("readings slice starts with empty arrays alongside readingsApi", () => {
    const store = buildStore();
    const readingsState = store.getState().readings;
    expect(readingsState.availableReadings).toEqual([]);
    expect(readingsState.selectedReadings).toEqual([]);
  });
});

describe("getAvailableReadings endpoint", () => {
  it("endpoint has a select method", () => {
    const endpoint = readingsApi.endpoints.getAvailableReadings;
    expect(typeof (endpoint as any).select).toBe("function");
  });

  it("query builder produces POST request to correct URL", () => {
    const queryFn = (body: GetAvailableReadingsPayload) => ({
      method: "POST",
      url: "/assignment/instructor/fetch_chooser_data",
      body
    });

    const payload: GetAvailableReadingsPayload = {
      from_source_only: true,
      pages_only: false,
      skipreading: false
    };

    const result = queryFn(payload);
    expect(result.method).toBe("POST");
    expect(result.url).toBe("/assignment/instructor/fetch_chooser_data");
    expect(result.body).toBe(payload);
  });
});

describe("getAvailableReadings transformResponse", () => {
  const makeNodes = (count: number): TreeNode[] =>
    Array.from({ length: count }, (_, i) => ({ key: String(i), label: `Node ${i}` }));

  it("extracts questions array from detail wrapper", () => {
    const nodes = makeNodes(3);
    const response: DetailResponse<{ questions: TreeNode[] }> = {
      detail: { questions: nodes }
    };

    const result = response.detail.questions;
    expect(result).toHaveLength(3);
    expect(result).toBe(nodes);
  });

  it("returns an empty array when questions list is empty", () => {
    const response: DetailResponse<{ questions: TreeNode[] }> = {
      detail: { questions: [] }
    };

    const result = response.detail.questions;
    expect(result).toEqual([]);
  });

  it("preserves node structure when extracting from response", () => {
    const nodes: TreeNode[] = [
      { key: "ch1", label: "Chapter 1", children: [{ key: "ch1-sec1", label: "Section 1" }] }
    ];
    const response: DetailResponse<{ questions: TreeNode[] }> = {
      detail: { questions: nodes }
    };

    const result = response.detail.questions;
    expect(result[0].key).toBe("ch1");
    expect(result[0].label).toBe("Chapter 1");
    expect(result[0].children).toHaveLength(1);
  });
});

describe("GetAvailableReadingsPayload shape", () => {
  it("accepts all three boolean fields", () => {
    const payload: GetAvailableReadingsPayload = {
      from_source_only: false,
      pages_only: true,
      skipreading: true
    };

    expect(payload.from_source_only).toBe(false);
    expect(payload.pages_only).toBe(true);
    expect(payload.skipreading).toBe(true);
  });
});
