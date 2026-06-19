import { renderHook } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import React from "react";
import { datasetSlice } from "@store/dataset/dataset.logic";
import { TableDropdownOption } from "@/types/dataset";
import { useTableDropdownOptions } from "./useTableDropdownOptions";

function buildOption(value: string, types: string[]): TableDropdownOption {
  return {
    value,
    label: value,
    description: `${value} option`,
    supported_question_types: types
  };
}

function makeStore(
  autoGradeOptions: TableDropdownOption[] = [],
  whichToGradeOptions: TableDropdownOption[] = []
) {
  return configureStore({
    reducer: { dataset: datasetSlice.reducer },
    preloadedState: {
      dataset: {
        autoGradeOptions,
        whichToGradeOptions,
        languageOptions: [],
        questionTypeOptions: [],
        sections: []
      }
    }
  });
}

function renderWithStore(
  autoGradeOptions: TableDropdownOption[],
  whichToGradeOptions: TableDropdownOption[],
  question_type?: string
) {
  const store = makeStore(autoGradeOptions, whichToGradeOptions);
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store }, children);

  return renderHook(() => useTableDropdownOptions(question_type), { wrapper });
}

describe("useTableDropdownOptions", () => {
  describe("when no question_type is provided", () => {
    it("returns all autograde options without filtering", () => {
      const autoGradeOptions = [
        buildOption("pct_correct", ["mchoice"]),
        buildOption("all_or_nothing", ["activecode"])
      ];
      const { result } = renderWithStore(autoGradeOptions, []);

      expect(result.current.autograde).toEqual(autoGradeOptions);
    });

    it("returns all which_to_grade options without filtering", () => {
      const whichToGradeOptions = [
        buildOption("first_answer", ["mchoice"]),
        buildOption("last_answer", ["activecode"])
      ];
      const { result } = renderWithStore([], whichToGradeOptions);

      expect(result.current.which_to_grade).toEqual(whichToGradeOptions);
    });

    it("returns empty arrays when store has no options", () => {
      const { result } = renderWithStore([], []);

      expect(result.current.autograde).toEqual([]);
      expect(result.current.which_to_grade).toEqual([]);
    });
  });

  describe("when question_type is an empty string", () => {
    it("returns all autograde options without filtering", () => {
      const autoGradeOptions = [buildOption("pct_correct", ["mchoice"])];
      const { result } = renderWithStore(autoGradeOptions, [], "");

      expect(result.current.autograde).toEqual(autoGradeOptions);
    });
  });

  describe("when question_type matches some options", () => {
    it("returns only autograde options that include the question_type", () => {
      const autoGradeOptions = [
        buildOption("pct_correct", ["mchoice", "activecode"]),
        buildOption("all_or_nothing", ["activecode"]),
        buildOption("no_grade", ["parsons"])
      ];
      const { result } = renderWithStore(autoGradeOptions, [], "mchoice");

      expect(result.current.autograde).toHaveLength(1);
      expect(result.current.autograde[0].value).toBe("pct_correct");
    });

    it("returns only which_to_grade options that include the question_type", () => {
      const whichToGradeOptions = [
        buildOption("first_answer", ["mchoice"]),
        buildOption("last_answer", ["mchoice", "activecode"]),
        buildOption("best_answer", ["parsons"])
      ];
      const { result } = renderWithStore([], whichToGradeOptions, "mchoice");

      expect(result.current.which_to_grade).toHaveLength(2);
      expect(result.current.which_to_grade.map((o) => o.value)).toEqual([
        "first_answer",
        "last_answer"
      ]);
    });

    it("returns empty array when no options support the given question_type", () => {
      const autoGradeOptions = [buildOption("pct_correct", ["mchoice"])];
      const { result } = renderWithStore(autoGradeOptions, [], "activecode");

      expect(result.current.autograde).toEqual([]);
    });

    it("returns all options when all of them support the given question_type", () => {
      const autoGradeOptions = [
        buildOption("pct_correct", ["mchoice", "activecode"]),
        buildOption("all_or_nothing", ["activecode"])
      ];
      const { result } = renderWithStore(autoGradeOptions, [], "activecode");

      expect(result.current.autograde).toHaveLength(2);
    });
  });

  describe("return shape", () => {
    it("always returns an object with autograde and which_to_grade keys", () => {
      const { result } = renderWithStore([], []);

      expect(result.current).toHaveProperty("autograde");
      expect(result.current).toHaveProperty("which_to_grade");
    });

    it("autograde and which_to_grade are filtered independently", () => {
      const autoGradeOptions = [
        buildOption("pct_correct", ["mchoice"]),
        buildOption("all_or_nothing", ["activecode"])
      ];
      const whichToGradeOptions = [
        buildOption("first_answer", ["mchoice"]),
        buildOption("last_answer", ["activecode"])
      ];
      const { result } = renderWithStore(autoGradeOptions, whichToGradeOptions, "mchoice");

      expect(result.current.autograde).toHaveLength(1);
      expect(result.current.autograde[0].value).toBe("pct_correct");
      expect(result.current.which_to_grade).toHaveLength(1);
      expect(result.current.which_to_grade[0].value).toBe("first_answer");
    });
  });
});
