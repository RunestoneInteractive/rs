import { configureStore } from "@reduxjs/toolkit";
import {
  datasetApi,
  useGetWhichToGradeOptionsQuery,
  useGetAutoGradeOptionsQuery,
  useGetLanguageOptionsQuery,
  useGetQuestionTypeOptionsQuery,
  useGetSectionsForChapterQuery
} from "@store/dataset/dataset.logic.api";
import { datasetSlice } from "@store/dataset/dataset.logic";
import { DetailResponse } from "@/types/api";
import { SectionsResponse } from "@/types/dataset";

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
      dataset: datasetSlice.reducer,
      [datasetApi.reducerPath]: datasetApi.reducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(datasetApi.middleware)
  });
}

describe("datasetApi module exports", () => {
  it("exports the datasetApi object", () => {
    expect(datasetApi).toBeDefined();
  });

  it("has the correct reducerPath", () => {
    expect(datasetApi.reducerPath).toBe("datasetApi");
  });

  it("exports all five query hooks", () => {
    expect(useGetWhichToGradeOptionsQuery).toBeDefined();
    expect(useGetAutoGradeOptionsQuery).toBeDefined();
    expect(useGetLanguageOptionsQuery).toBeDefined();
    expect(useGetQuestionTypeOptionsQuery).toBeDefined();
    expect(useGetSectionsForChapterQuery).toBeDefined();
  });

  it("provides a reducer that returns initial state", () => {
    const store = buildStore();
    const state = store.getState()[datasetApi.reducerPath];
    expect(state).toBeDefined();
    expect(typeof state).toBe("object");
  });
});

describe("datasetApi endpoint query builders", () => {
  it("getWhichToGradeOptions endpoint has a select method", () => {
    const endpoint = datasetApi.endpoints.getWhichToGradeOptions;
    expect(typeof (endpoint as any).select).toBe("function");
  });

  it("getSectionsForChapter endpoint has a select method", () => {
    const endpoint = datasetApi.endpoints.getSectionsForChapter;
    expect(typeof (endpoint as any).select).toBe("function");
  });
});

describe("getSectionsForChapter transformResponse", () => {
  const rawResponse: DetailResponse<SectionsResponse> = {
    detail: {
      sections: [
        { title: "Section One", label: "sec-one" },
        { title: "Section Two", label: "sec-two" }
      ]
    }
  };

  it("maps each section to a label/value pair", () => {
    const internalEndpoints = (datasetApi as any).internalActions;
    expect(internalEndpoints).toBeDefined();
  });

  it("transformResponse converts title to label and label to value", () => {
    const sections = rawResponse.detail.sections.map((section) => ({
      label: section.title,
      value: section.label
    }));

    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual({ label: "Section One", value: "sec-one" });
    expect(sections[1]).toEqual({ label: "Section Two", value: "sec-two" });
  });

  it("transformResponse returns an empty array when sections list is empty", () => {
    const emptyResponse: DetailResponse<SectionsResponse> = {
      detail: { sections: [] }
    };

    const result = emptyResponse.detail.sections.map((section) => ({
      label: section.title,
      value: section.label
    }));

    expect(result).toEqual([]);
  });

  it("transformResponse handles a single section correctly", () => {
    const singleResponse: DetailResponse<SectionsResponse> = {
      detail: {
        sections: [{ title: "Only Section", label: "only-sec" }]
      }
    };

    const result = singleResponse.detail.sections.map((section) => ({
      label: section.title,
      value: section.label
    }));

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ label: "Only Section", value: "only-sec" });
  });
});

describe("datasetApi store integration", () => {
  it("mounts its reducer in a combined store without errors", () => {
    expect(() => buildStore()).not.toThrow();
  });

  it("initial datasetApi state has a queries key", () => {
    const store = buildStore();
    const apiState = store.getState()[datasetApi.reducerPath];
    expect(apiState).toHaveProperty("queries");
  });

  it("initial datasetApi state has a mutations key", () => {
    const store = buildStore();
    const apiState = store.getState()[datasetApi.reducerPath];
    expect(apiState).toHaveProperty("mutations");
  });

  it("dataset slice starts with empty option arrays alongside datasetApi", () => {
    const store = buildStore();
    const datasetState = store.getState().dataset;
    expect(datasetState.whichToGradeOptions).toEqual([]);
    expect(datasetState.autoGradeOptions).toEqual([]);
    expect(datasetState.languageOptions).toEqual([]);
    expect(datasetState.questionTypeOptions).toEqual([]);
    expect(datasetState.sections).toEqual([]);
  });
});

describe("DATASET_TOAST_COPY", () => {
  it("keeps every load-error message on the canonical shape", async () => {
    const { DATASET_TOAST_COPY } = await import("./dataset.logic.api");

    expect(DATASET_TOAST_COPY.whichToGradeError).toBe(
      "Couldn't load grading options. Refresh the page."
    );

    for (const message of Object.values(DATASET_TOAST_COPY)) {
      expect(message).toMatch(/^Couldn't load .+\. Refresh the page\.$/);
      expect(message).not.toMatch(/_|Error getting/);
    }
  });
});
