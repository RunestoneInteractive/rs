import { renderHook, act } from "@testing-library/react";

import { useExerciseStepNavigation } from "./useExerciseStepNavigation";
import type { UseExerciseStepNavigationProps } from "./useExerciseStepNavigation";
import type { CreateExerciseFormType } from "@/types/exercises";
import type { StepValidator } from "../config/stepConfigs";

type TestData = Partial<CreateExerciseFormType>;

const steps = [{ label: "Step 1" }, { label: "Step 2" }, { label: "Step 3" }];

const validatorAlwaysValid: StepValidator<TestData> = () => [];
const validatorAlwaysInvalid: StepValidator<TestData> = () => ["Field is required"];

function makeProps(
  overrides: Partial<UseExerciseStepNavigationProps<TestData>> = {}
): UseExerciseStepNavigationProps<TestData> {
  return {
    data: {},
    activeStep: 0,
    setActiveStep: vi.fn(),
    stepValidators: [validatorAlwaysValid, validatorAlwaysValid, validatorAlwaysValid],
    goToNextStep: vi.fn(),
    goToPrevStep: vi.fn(),
    steps,
    handleBaseSave: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("useExerciseStepNavigation", () => {
  describe("initial state", () => {
    it("returns undefined validation before any user interaction", () => {
      const props = makeProps();
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      expect(result.current.validation).toBeUndefined();
    });

    it("computes stepsValidity for all steps on mount", () => {
      const validators: StepValidator<TestData>[] = [
        validatorAlwaysValid,
        validatorAlwaysInvalid,
        validatorAlwaysValid
      ];
      const props = makeProps({ stepValidators: validators });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      expect(result.current.stepsValidity[0]).toBe(true);
      expect(result.current.stepsValidity[1]).toBe(false);
      expect(result.current.stepsValidity[2]).toBe(true);
    });

    it("marks a step as valid when there is no validator for that index", () => {
      const props = makeProps({ stepValidators: [] });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      expect(result.current.stepsValidity[0]).toBe(true);
      expect(result.current.stepsValidity[1]).toBe(true);
      expect(result.current.stepsValidity[2]).toBe(true);
    });
  });

  describe("handleNext", () => {
    it("calls goToNextStep when the current step is valid", () => {
      const goToNextStep = vi.fn();
      const props = makeProps({ goToNextStep, stepValidators: [validatorAlwaysValid] });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      act(() => result.current.handleNext());
      expect(goToNextStep).toHaveBeenCalledOnce();
    });

    it("does not call goToNextStep when the current step is invalid", () => {
      const goToNextStep = vi.fn();
      const props = makeProps({
        goToNextStep,
        stepValidators: [validatorAlwaysInvalid, validatorAlwaysValid, validatorAlwaysValid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      act(() => result.current.handleNext());
      expect(goToNextStep).not.toHaveBeenCalled();
    });

    it("exposes validation errors after handleNext is called on an invalid step", () => {
      const props = makeProps({
        stepValidators: [validatorAlwaysInvalid, validatorAlwaysValid, validatorAlwaysValid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      act(() => result.current.handleNext());
      expect(result.current.validation?.isValid).toBe(false);
      expect(result.current.validation?.errors).toEqual(["Field is required"]);
    });

    it("exposes empty errors after handleNext on a valid step", () => {
      const props = makeProps({ stepValidators: [validatorAlwaysValid] });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      act(() => result.current.handleNext());
      expect(result.current.validation?.isValid).toBe(true);
      expect(result.current.validation?.errors).toEqual([]);
    });

    it("returns isValid true when there is no validator for the active step and handleNext is called", () => {
      const props = makeProps({ stepValidators: [] });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      act(() => result.current.handleNext());
      expect(result.current.validation?.isValid).toBe(true);
    });
  });

  describe("handleStepSelect", () => {
    it("always allows backward navigation without running validation", () => {
      const setActiveStep = vi.fn();
      const props = makeProps({
        activeStep: 2,
        setActiveStep,
        stepValidators: [validatorAlwaysInvalid, validatorAlwaysInvalid, validatorAlwaysInvalid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      act(() => result.current.handleStepSelect(0));
      expect(setActiveStep).toHaveBeenCalledWith(0);
      expect(result.current.validation).toBeUndefined();
    });

    it("allows forward navigation when the current step is valid", () => {
      const setActiveStep = vi.fn();
      const props = makeProps({
        activeStep: 0,
        setActiveStep,
        stepValidators: [validatorAlwaysValid, validatorAlwaysValid, validatorAlwaysValid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      act(() => result.current.handleStepSelect(2));
      expect(setActiveStep).toHaveBeenCalledWith(2);
    });

    it("blocks forward navigation when the current step is invalid", () => {
      const setActiveStep = vi.fn();
      const props = makeProps({
        activeStep: 0,
        setActiveStep,
        stepValidators: [validatorAlwaysInvalid, validatorAlwaysValid, validatorAlwaysValid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      act(() => result.current.handleStepSelect(1));
      expect(setActiveStep).not.toHaveBeenCalled();
    });

    it("sets validation errors visible when forward navigation is attempted on invalid step", () => {
      const props = makeProps({
        activeStep: 0,
        stepValidators: [validatorAlwaysInvalid, validatorAlwaysValid, validatorAlwaysValid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      act(() => result.current.handleStepSelect(1));
      expect(result.current.validation?.isValid).toBe(false);
    });

    it("allows navigation to same index (treated as not forward)", () => {
      const setActiveStep = vi.fn();
      const props = makeProps({
        activeStep: 1,
        setActiveStep,
        stepValidators: [validatorAlwaysInvalid, validatorAlwaysInvalid, validatorAlwaysInvalid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      act(() => result.current.handleStepSelect(1));
      expect(setActiveStep).toHaveBeenCalledWith(1);
    });
  });

  describe("handleSave", () => {
    it("calls handleBaseSave when all steps are valid", async () => {
      const handleBaseSave = vi.fn().mockResolvedValue(undefined);
      const props = makeProps({
        handleBaseSave,
        stepValidators: [validatorAlwaysValid, validatorAlwaysValid, validatorAlwaysValid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      await act(async () => result.current.handleSave());
      expect(handleBaseSave).toHaveBeenCalledOnce();
    });

    it("does not call handleBaseSave when any step is invalid", async () => {
      const handleBaseSave = vi.fn().mockResolvedValue(undefined);
      const props = makeProps({
        handleBaseSave,
        stepValidators: [validatorAlwaysValid, validatorAlwaysInvalid, validatorAlwaysValid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      await act(async () => result.current.handleSave());
      expect(handleBaseSave).not.toHaveBeenCalled();
    });

    it("generates html source and updates form data before saving when generators are provided", async () => {
      const handleBaseSave = vi.fn().mockResolvedValue(undefined);
      const updateFormData = vi.fn();
      const generateHtmlSrc = vi.fn().mockReturnValue("<html>generated</html>");
      const data: TestData = { name: "test" };
      const props = makeProps({
        data,
        handleBaseSave,
        updateFormData,
        generateHtmlSrc,
        stepValidators: [validatorAlwaysValid, validatorAlwaysValid, validatorAlwaysValid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      await act(async () => result.current.handleSave());
      expect(generateHtmlSrc).toHaveBeenCalledWith(data);
      expect(updateFormData).toHaveBeenCalledWith("htmlsrc", "<html>generated</html>");
      expect(handleBaseSave).toHaveBeenCalledOnce();
    });

    it("does not call generateHtmlSrc when only generateHtmlSrc is provided but updateFormData is missing", async () => {
      const handleBaseSave = vi.fn().mockResolvedValue(undefined);
      const generateHtmlSrc = vi.fn().mockReturnValue("<html>x</html>");
      const props = makeProps({
        handleBaseSave,
        generateHtmlSrc,
        stepValidators: [validatorAlwaysValid, validatorAlwaysValid, validatorAlwaysValid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      await act(async () => result.current.handleSave());
      expect(generateHtmlSrc).not.toHaveBeenCalled();
      expect(handleBaseSave).toHaveBeenCalledOnce();
    });

    it("shows validation after failed save attempt", async () => {
      const props = makeProps({
        handleBaseSave: vi.fn().mockResolvedValue(undefined),
        stepValidators: [validatorAlwaysInvalid, validatorAlwaysValid, validatorAlwaysValid]
      });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      await act(async () => result.current.handleSave());
      expect(result.current.validation?.isValid).toBe(false);
    });
  });

  describe("validation reset on step change", () => {
    it("resets validation to undefined when activeStep prop changes", () => {
      const props = makeProps({
        activeStep: 0,
        stepValidators: [validatorAlwaysInvalid, validatorAlwaysValid, validatorAlwaysValid]
      });
      const { result, rerender } = renderHook(
        (p: UseExerciseStepNavigationProps<TestData>) => useExerciseStepNavigation(p),
        { initialProps: props }
      );

      act(() => result.current.handleNext());
      expect(result.current.validation).not.toBeUndefined();

      rerender({ ...props, activeStep: 1 });
      expect(result.current.validation).toBeUndefined();
    });
  });

  describe("stepsValidity with no validators", () => {
    it("returns true for every step index when stepValidators array is empty", () => {
      const props = makeProps({ stepValidators: [] });
      const { result } = renderHook(() => useExerciseStepNavigation(props));
      steps.forEach((_, i) => {
        expect(result.current.stepsValidity[i]).toBe(true);
      });
    });
  });

  describe("stepsValidity reacts to data changes", () => {
    it("updates stepsValidity when data changes from invalid to valid", () => {
      const validator: StepValidator<TestData> = (data) => (!data.name ? ["Name is required"] : []);
      const initialData: TestData = {};
      const props = makeProps({ data: initialData, stepValidators: [validator] });
      const { result, rerender } = renderHook(
        (p: UseExerciseStepNavigationProps<TestData>) => useExerciseStepNavigation(p),
        { initialProps: props }
      );

      expect(result.current.stepsValidity[0]).toBe(false);

      rerender({ ...props, data: { name: "My Exercise" } });
      expect(result.current.stepsValidity[0]).toBe(true);
    });
  });
});
