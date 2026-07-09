import { configureStore } from "@reduxjs/toolkit";
import { renderHook, act } from "@testing-library/react";
import { Provider } from "react-redux";
import React from "react";

import { datasetSlice, datasetActions } from "@store/dataset/dataset.logic";
import { getExerciseColorScheme } from "@/config/exerciseTypes";
import { useExerciseTypes } from "./useExerciseTypes";

function makeWrapper(store: ReturnType<typeof makeStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store }, children);
  };
}

function makeStore(questionTypeOptions = []) {
  return configureStore({
    reducer: { dataset: datasetSlice.reducer },
    preloadedState: {
      dataset: {
        whichToGradeOptions: [],
        autoGradeOptions: [],
        languageOptions: [],
        questionTypeOptions,
        sections: []
      }
    }
  });
}

describe("useExerciseTypes", () => {
  it("returns an empty array when the store has no question type options", () => {
    const store = makeStore([]);
    const { result } = renderHook(() => useExerciseTypes(), { wrapper: makeWrapper(store) });

    expect(result.current).toEqual([]);
  });

  it("filters out the webwork question type from the returned list", () => {
    const store = makeStore([
      { value: "mchoice", label: "Multiple Choice", description: "MC" },
      { value: "webwork", label: "WeBWorK", description: "WW" },
      { value: "fitb", label: "Fill in the Blank", description: "FITB" }
    ] as any);
    const { result } = renderHook(() => useExerciseTypes(), { wrapper: makeWrapper(store) });

    const values = result.current.map((e) => e.value);
    expect(values).not.toContain("webwork");
    expect(values).toContain("mchoice");
    expect(values).toContain("fitb");
  });

  it("includes the tag field equal to the option value on each returned item", () => {
    const store = makeStore([
      { value: "activecode", label: "Active Code", description: "AC" },
      { value: "mchoice", label: "Multiple Choice", description: "MC" }
    ] as any);
    const { result } = renderHook(() => useExerciseTypes(), { wrapper: makeWrapper(store) });

    result.current.forEach((item) => {
      expect(item.tag).toBe(item.value);
    });
  });

  it("assigns each type its family color scheme from the token map", () => {
    const store = makeStore([
      { value: "activecode", label: "Active Code", description: "AC" },
      { value: "mchoice", label: "Multiple Choice", description: "MC" }
    ] as any);
    const { result } = renderHook(() => useExerciseTypes(), { wrapper: makeWrapper(store) });

    expect(result.current[0].color).toEqual(getExerciseColorScheme("activecode"));
    expect(result.current[0].color.background).toBe("var(--rs-extype-code-bg)");
    expect(result.current[1].color).toEqual(getExerciseColorScheme("mchoice"));
    expect(result.current[1].color.background).toBe("var(--rs-extype-choice-bg)");
  });

  it("preserves label and description from the original option", () => {
    const store = makeStore([
      { value: "parsons", label: "Parsons Problem", description: "Drag and drop" }
    ] as any);
    const { result } = renderHook(() => useExerciseTypes(), { wrapper: makeWrapper(store) });

    expect(result.current[0].label).toBe("Parsons Problem");
    expect(result.current[0].description).toBe("Drag and drop");
  });

  it("only webwork is excluded when multiple unsupported-looking types are present", () => {
    const store = makeStore([
      { value: "webwork", label: "WeBWorK", description: "WW" },
      { value: "mchoice", label: "Multiple Choice", description: "MC" },
      { value: "shortanswer", label: "Short Answer", description: "SA" }
    ] as any);
    const { result } = renderHook(() => useExerciseTypes(), { wrapper: makeWrapper(store) });

    expect(result.current).toHaveLength(2);
    expect(result.current.map((e) => e.value)).toEqual(["mchoice", "shortanswer"]);
  });

  it("returns an empty array when all options are webwork", () => {
    const store = makeStore([
      { value: "webwork", label: "WeBWorK 1", description: "WW1" },
      { value: "webwork", label: "WeBWorK 2", description: "WW2" }
    ] as any);
    const { result } = renderHook(() => useExerciseTypes(), { wrapper: makeWrapper(store) });

    expect(result.current).toEqual([]);
  });

  it("updates the returned list when the store state changes", () => {
    const store = makeStore([]);
    const { result, rerender } = renderHook(() => useExerciseTypes(), {
      wrapper: makeWrapper(store)
    });

    expect(result.current).toHaveLength(0);

    act(() => {
      store.dispatch(
        datasetActions.setQuestionTypeOptions([
          { value: "mchoice", label: "Multiple Choice", description: "MC" }
        ])
      );
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].value).toBe("mchoice");
  });

  it("renames the raw Parsonsprob server label to Parsons problem", () => {
    const store = makeStore([
      { value: "parsonsprob", label: "Parsonsprob", description: "Arrange code blocks" },
      { value: "mchoice", label: "Multiple Choice", description: "MC" }
    ] as any);
    const { result } = renderHook(() => useExerciseTypes(), { wrapper: makeWrapper(store) });

    const parsons = result.current.find((e) => e.value === "parsonsprob");

    expect(parsons?.label).toBe("Parsons problem");
    expect(result.current.find((e) => e.value === "mchoice")?.label).toBe("Multiple Choice");
  });
});
