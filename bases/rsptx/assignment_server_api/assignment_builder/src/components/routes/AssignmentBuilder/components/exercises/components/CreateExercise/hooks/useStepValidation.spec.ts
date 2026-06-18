import { renderHook } from "@testing-library/react";

import { CreateExerciseFormType } from "@/types/exercises";

import { StepValidator } from "../config/stepConfigs";
import { useStepValidation } from "./useStepValidation";

type TestData = Partial<CreateExerciseFormType>;

const makeValidator =
  (errors: string[]): StepValidator<TestData> =>
  () =>
    errors;

describe("useStepValidation", () => {
  describe("when no validator exists for the active step", () => {
    it("returns isValid true and empty errors array", () => {
      const { result } = renderHook(() =>
        useStepValidation({
          data: {},
          activeStep: 5,
          stepValidators: []
        })
      );

      expect(result.current.isValid).toBe(true);
      expect(result.current.errors).toEqual([]);
    });

    it("returns isValid true when stepValidators array is empty and activeStep is 0", () => {
      const { result } = renderHook(() =>
        useStepValidation({
          data: {},
          activeStep: 0,
          stepValidators: []
        })
      );

      expect(result.current.isValid).toBe(true);
      expect(result.current.errors).toEqual([]);
    });
  });

  describe("when the validator for the active step returns no errors", () => {
    it("returns isValid true and empty errors array", () => {
      const validators: StepValidator<TestData>[] = [makeValidator([])];

      const { result } = renderHook(() =>
        useStepValidation({
          data: {},
          activeStep: 0,
          stepValidators: validators
        })
      );

      expect(result.current.isValid).toBe(true);
      expect(result.current.errors).toEqual([]);
    });
  });

  describe("when the validator for the active step returns errors", () => {
    it("returns isValid false and the error messages", () => {
      const validators: StepValidator<TestData>[] = [
        makeValidator(["Field is required", "Another error"])
      ];

      const { result } = renderHook(() =>
        useStepValidation({
          data: {},
          activeStep: 0,
          stepValidators: validators
        })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.errors).toEqual(["Field is required", "Another error"]);
    });
  });

  describe("when there are multiple validators and the active step selects a specific one", () => {
    it("runs only the validator at the active step index", () => {
      const validators: StepValidator<TestData>[] = [
        makeValidator(["step 0 error"]),
        makeValidator([]),
        makeValidator(["step 2 error"])
      ];

      const { result: step0 } = renderHook(() =>
        useStepValidation({ data: {}, activeStep: 0, stepValidators: validators })
      );
      const { result: step1 } = renderHook(() =>
        useStepValidation({ data: {}, activeStep: 1, stepValidators: validators })
      );
      const { result: step2 } = renderHook(() =>
        useStepValidation({ data: {}, activeStep: 2, stepValidators: validators })
      );

      expect(step0.current.isValid).toBe(false);
      expect(step0.current.errors).toEqual(["step 0 error"]);

      expect(step1.current.isValid).toBe(true);
      expect(step1.current.errors).toEqual([]);

      expect(step2.current.isValid).toBe(false);
      expect(step2.current.errors).toEqual(["step 2 error"]);
    });
  });

  describe("when the validator receives the provided data", () => {
    it("passes the data object to the validator function", () => {
      const receivedData: TestData[] = [];
      const captureValidator: StepValidator<TestData> = (data) => {
        receivedData.push(data);
        return [];
      };

      const testData: TestData = { name: "My Exercise", points: 10 };

      renderHook(() =>
        useStepValidation({
          data: testData,
          activeStep: 0,
          stepValidators: [captureValidator]
        })
      );

      expect(receivedData).toHaveLength(1);
      expect(receivedData[0]).toBe(testData);
    });
  });

  describe("memoization behavior", () => {
    it("returns the same reference when props do not change", () => {
      const validators: StepValidator<TestData>[] = [makeValidator([])];
      const data: TestData = { name: "test" };

      const { result, rerender } = renderHook(
        ({ d, step, v }) => useStepValidation({ data: d, activeStep: step, stepValidators: v }),
        { initialProps: { d: data, step: 0, v: validators } }
      );

      const first = result.current;
      rerender({ d: data, step: 0, v: validators });

      expect(result.current).toBe(first);
    });

    it("recomputes when activeStep changes", () => {
      const validators: StepValidator<TestData>[] = [
        makeValidator(["error at 0"]),
        makeValidator([])
      ];
      const data: TestData = {};

      const { result, rerender } = renderHook(
        ({ step }) => useStepValidation({ data, activeStep: step, stepValidators: validators }),
        { initialProps: { step: 0 } }
      );

      expect(result.current.isValid).toBe(false);

      rerender({ step: 1 });

      expect(result.current.isValid).toBe(true);
    });

    it("recomputes when data changes", () => {
      const capturedCalls: TestData[] = [];
      const validator: StepValidator<TestData> = (d) => {
        capturedCalls.push(d);
        return d.name ? [] : ["Name required"];
      };

      const { result, rerender } = renderHook(
        ({ d }) => useStepValidation({ data: d, activeStep: 0, stepValidators: [validator] }),
        { initialProps: { d: {} as TestData } }
      );

      expect(result.current.isValid).toBe(false);

      rerender({ d: { name: "filled" } });

      expect(result.current.isValid).toBe(true);
    });
  });

  describe("single error in the returned array", () => {
    it("isValid is false when exactly one error is returned", () => {
      const validators: StepValidator<TestData>[] = [makeValidator(["Single error"])];

      const { result } = renderHook(() =>
        useStepValidation({ data: {}, activeStep: 0, stepValidators: validators })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0]).toBe("Single error");
    });
  });
});
