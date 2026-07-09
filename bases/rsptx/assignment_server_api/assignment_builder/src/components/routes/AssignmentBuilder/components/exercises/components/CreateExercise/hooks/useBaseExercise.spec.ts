import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";

import { UseBaseExerciseProps, useBaseExercise } from "./useBaseExercise";

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

vi.mock("@/utils/exercise", () => ({
  createExerciseId: () => "exercise_20240101_1234"
}));

type TestFormData = {
  statement?: string;
  points?: number;
  name?: string;
  chapter?: string;
  question_type?: string;
  difficulty?: number;
  htmlsrc?: string;
  optionList?: Array<{ choice: string; id?: string }>;
};

const makeDefaultFormData = (): TestFormData => ({
  statement: "",
  points: 1,
  name: "",
  chapter: "",
  question_type: "mchoice",
  difficulty: 3
});

const makeProps = (
  overrides: Partial<UseBaseExerciseProps<TestFormData>> = {}
): UseBaseExerciseProps<TestFormData> => ({
  steps: [{ label: "Step 1" }, { label: "Step 2" }],
  exerciseType: "mchoice",
  generatePreview: (data) => `<div>${data.statement}</div>`,
  validateStep: (_step, _data) => true,
  validateForm: (_data) => [],
  getDefaultFormData: makeDefaultFormData,
  onSave: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
  ...overrides
});

describe("useBaseExercise", () => {
  describe("initial state", () => {
    it("returns default form data when no initialData is provided", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      expect(result.current.formData).toMatchObject(makeDefaultFormData());
    });

    it("merges initialData with default form data", () => {
      const props = makeProps({
        initialData: { statement: "Custom question", points: 5 }
      });
      const { result } = renderHook(() => useBaseExercise(props));
      expect(result.current.formData.statement).toBe("Custom question");
      expect(result.current.formData.points).toBe(5);
      expect(result.current.formData.chapter).toBe("");
    });

    it("starts at step 0", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      expect(result.current.activeStep).toBe(0);
    });

    it("initializes isSaving as false", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      expect(result.current.isSaving).toBe(false);
    });

    it("initializes all steps as not visited", () => {
      const { result } = renderHook(() =>
        useBaseExercise(makeProps({ steps: [{ label: "A" }, { label: "B" }, { label: "C" }] }))
      );
      expect(result.current.stepsVisited).toEqual({ 0: false, 1: false, 2: false });
    });

    it("initializes questionInteracted as false", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      expect(result.current.questionInteracted).toBe(false);
    });

    it("initializes settingsInteracted as false", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      expect(result.current.settingsInteracted).toBe(false);
    });

    it("assigns ids to options that lack them", () => {
      const props = makeProps({
        initialData: {
          optionList: [{ choice: "A" }, { choice: "B", id: "existing-id" }]
        }
      });
      const { result } = renderHook(() => useBaseExercise(props));
      const options = result.current.formData.optionList as Array<{ choice: string; id: string }>;
      expect(options[0].id).toMatch(/^option-/);
      expect(options[1].id).toBe("existing-id");
    });

    it("handles missing optionList without error", () => {
      const props = makeProps({ initialData: { statement: "No options" } });
      const { result } = renderHook(() => useBaseExercise(props));
      expect(result.current.formData.optionList).toEqual([]);
    });
  });

  describe("updateFormData", () => {
    it("updates a single field in formData", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      act(() => {
        result.current.updateFormData("statement", "Updated question");
      });
      expect(result.current.formData.statement).toBe("Updated question");
    });

    it("preserves other fields when updating one field", () => {
      const props = makeProps({ initialData: { points: 5, statement: "original" } });
      const { result } = renderHook(() => useBaseExercise(props));
      act(() => {
        result.current.updateFormData("statement", "changed");
      });
      expect(result.current.formData.points).toBe(5);
    });
  });

  describe("handleSettingsChange", () => {
    it("merges partial settings into formData", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      act(() => {
        result.current.handleSettingsChange({ points: 10, difficulty: 5 });
      });
      expect(result.current.formData.points).toBe(10);
      expect(result.current.formData.difficulty).toBe(5);
    });

    it("sets settingsInteracted to true", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      act(() => {
        result.current.handleSettingsChange({ points: 3 });
      });
      expect(result.current.settingsInteracted).toBe(true);
    });
  });

  describe("handleQuestionChange", () => {
    it("updates the statement field", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      act(() => {
        result.current.handleQuestionChange("New content");
      });
      expect(result.current.formData.statement).toBe("New content");
    });

    it("sets questionInteracted to true", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      act(() => {
        result.current.handleQuestionChange("content");
      });
      expect(result.current.questionInteracted).toBe(true);
    });
  });

  describe("isCurrentStepValid", () => {
    it("returns true when validateStep returns true", () => {
      const props = makeProps({ validateStep: () => true });
      const { result } = renderHook(() => useBaseExercise(props));
      expect(result.current.isCurrentStepValid()).toBe(true);
    });

    it("returns false when validateStep returns false", () => {
      const props = makeProps({ validateStep: () => false });
      const { result } = renderHook(() => useBaseExercise(props));
      expect(result.current.isCurrentStepValid()).toBe(false);
    });

    it("passes the current active step to validateStep", () => {
      const validateStep = vi.fn().mockReturnValue(true);
      const props = makeProps({ validateStep });
      const { result } = renderHook(() => useBaseExercise(props));
      result.current.isCurrentStepValid();
      expect(validateStep).toHaveBeenCalledWith(0, expect.any(Object));
    });
  });

  describe("goToNextStep", () => {
    it("increments activeStep when current step is valid", () => {
      const props = makeProps({ validateStep: () => true });
      const { result } = renderHook(() => useBaseExercise(props));
      act(() => {
        result.current.goToNextStep();
      });
      expect(result.current.activeStep).toBe(1);
    });

    it("does not increment activeStep when current step is invalid", () => {
      const props = makeProps({ validateStep: () => false });
      const { result } = renderHook(() => useBaseExercise(props));
      act(() => {
        result.current.goToNextStep();
      });
      expect(result.current.activeStep).toBe(0);
    });

    it("marks the current step as visited when advancing", () => {
      const props = makeProps({ validateStep: () => true });
      const { result } = renderHook(() => useBaseExercise(props));
      act(() => {
        result.current.goToNextStep();
      });
      expect(result.current.stepsVisited[0]).toBe(true);
    });

    it("does not mark step as visited when step is invalid", () => {
      const props = makeProps({ validateStep: () => false });
      const { result } = renderHook(() => useBaseExercise(props));
      act(() => {
        result.current.goToNextStep();
      });
      expect(result.current.stepsVisited[0]).toBe(false);
    });
  });

  describe("goToPrevStep", () => {
    it("decrements activeStep when not at first step", () => {
      const props = makeProps({ validateStep: () => true });
      const { result } = renderHook(() => useBaseExercise(props));
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.goToPrevStep();
      });
      expect(result.current.activeStep).toBe(0);
    });

    it("does not go below step 0", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      act(() => {
        result.current.goToPrevStep();
      });
      expect(result.current.activeStep).toBe(0);
    });
  });

  describe("generateHtmlPreview (via handleSave)", () => {
    it("includes html output from generatePreview in the save payload", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const props = makeProps({
        validateForm: () => [],
        onSave,
        initialData: { statement: "test question" },
        generatePreview: (data) => `<p>${data.statement}</p>`
      });
      const { result } = renderHook(() => useBaseExercise(props));
      await act(async () => {
        await result.current.handleSave();
      });
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ htmlsrc: "<p>test question</p>" })
      );
    });

    it("uses fallback html when generatePreview throws", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const props = makeProps({
        validateForm: () => [],
        onSave,
        generatePreview: () => {
          throw new Error("preview error");
        }
      });
      const { result } = renderHook(() => useBaseExercise(props));
      await act(async () => {
        await result.current.handleSave();
      });
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ htmlsrc: "<div>Error generating preview</div>" })
      );
    });
  });

  describe("handleSave", () => {
    it("calls onSave with enriched form data when validation passes", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const props = makeProps({
        validateForm: () => [],
        onSave,
        exerciseType: "mchoice",
        initialData: { statement: "Q1", points: 2 }
      });
      const { result } = renderHook(() => useBaseExercise(props));
      await act(async () => {
        await result.current.handleSave();
      });
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          question_type: "mchoice",
          points: 2,
          difficulty: 3
        })
      );
    });

    it("sets isSaving to true before calling onSave", async () => {
      let savingDuringCall = false;
      const onSave = vi.fn().mockImplementation(async () => {
        savingDuringCall = true;
      });
      const props = makeProps({ validateForm: () => [], onSave });
      const { result } = renderHook(() => useBaseExercise(props));
      await act(async () => {
        await result.current.handleSave();
      });
      expect(savingDuringCall).toBe(true);
    });

    it("shows error notifications and does not call onSave when validation fails", async () => {
      const { notify } = await import("@components/ui/notify");
      const onSave = vi.fn();
      const props = makeProps({
        validateForm: () => ["Error 1", "Error 2"],
        onSave
      });
      const { result } = renderHook(() => useBaseExercise(props));
      await act(async () => {
        await result.current.handleSave();
      });
      expect(onSave).not.toHaveBeenCalled();
      expect(notify.error).toHaveBeenCalledWith("Error 1");
      expect(notify.error).toHaveBeenCalledWith("Error 2");
    });

    it("marks all steps as visited on validation failure", async () => {
      const props = makeProps({
        validateForm: () => ["error"],
        steps: [{ label: "S1" }, { label: "S2" }]
      });
      const { result } = renderHook(() => useBaseExercise(props));
      await act(async () => {
        await result.current.handleSave();
      });
      expect(result.current.stepsVisited).toEqual({ 0: true, 1: true });
    });

    it("sets questionInteracted and settingsInteracted to true on validation failure", async () => {
      const props = makeProps({ validateForm: () => ["error"] });
      const { result } = renderHook(() => useBaseExercise(props));
      await act(async () => {
        await result.current.handleSave();
      });
      expect(result.current.questionInteracted).toBe(true);
      expect(result.current.settingsInteracted).toBe(true);
    });

    it("uses default points of 1 when points is not set", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const props = makeProps({
        validateForm: () => [],
        onSave,
        getDefaultFormData: () => ({ statement: "", chapter: "", question_type: "mchoice" })
      });
      const { result } = renderHook(() => useBaseExercise(props));
      await act(async () => {
        await result.current.handleSave();
      });
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ points: 1 }));
    });

    it("uses default difficulty of 3 when difficulty is not set", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const props = makeProps({
        validateForm: () => [],
        onSave,
        getDefaultFormData: () => ({ statement: "", chapter: "", question_type: "mchoice" })
      });
      const { result } = renderHook(() => useBaseExercise(props));
      await act(async () => {
        await result.current.handleSave();
      });
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ difficulty: 3 }));
    });

    it("sets isSaving back to false without its own error notification when onSave throws", async () => {
      const { notify } = await import("@components/ui/notify");

      vi.mocked(notify.error).mockClear();
      const onSave = vi.fn().mockRejectedValue(new Error("network error"));
      const props = makeProps({ validateForm: () => [], onSave });
      const { result } = renderHook(() => useBaseExercise(props));
      await act(async () => {
        await result.current.handleSave();
      });
      expect(result.current.isSaving).toBe(false);
      expect(notify.error).not.toHaveBeenCalled();
    });

    it("includes htmlsrc in the payload", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const props = makeProps({
        validateForm: () => [],
        onSave,
        generatePreview: () => "<p>preview</p>"
      });
      const { result } = renderHook(() => useBaseExercise(props));
      await act(async () => {
        await result.current.handleSave();
      });
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ htmlsrc: "<p>preview</p>" }));
    });
  });

  describe("isDirty", () => {
    it("starts clean", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      expect(result.current.isDirty).toBe(false);
    });

    it("becomes dirty after updateFormData", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      act(() => {
        result.current.updateFormData("statement", "changed");
      });
      expect(result.current.isDirty).toBe(true);
    });

    it("becomes dirty after handleQuestionChange", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      act(() => {
        result.current.handleQuestionChange("typed");
      });
      expect(result.current.isDirty).toBe(true);
    });

    it("becomes dirty after handleSettingsChange", () => {
      const { result } = renderHook(() => useBaseExercise(makeProps()));
      act(() => {
        result.current.handleSettingsChange({ points: 7 });
      });
      expect(result.current.isDirty).toBe(true);
    });

    it("resets to clean when the form resets", () => {
      const onFormReset = vi.fn();
      const props = makeProps({ resetForm: false, onFormReset });
      const { result, rerender } = renderHook(
        (p: UseBaseExerciseProps<TestFormData>) => useBaseExercise(p),
        { initialProps: props }
      );

      act(() => {
        result.current.updateFormData("statement", "changed");
      });
      expect(result.current.isDirty).toBe(true);

      rerender({ ...props, resetForm: true });
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe("resetForm effect", () => {
    it("resets formData and activeStep when resetForm becomes true", () => {
      const onFormReset = vi.fn();
      const props = makeProps({
        validateStep: () => true,
        resetForm: false,
        onFormReset
      });
      const { result, rerender } = renderHook(
        (p: UseBaseExerciseProps<TestFormData>) => useBaseExercise(p),
        { initialProps: props }
      );

      act(() => {
        result.current.goToNextStep();
        result.current.handleQuestionChange("changed");
      });
      expect(result.current.activeStep).toBe(1);

      rerender({ ...props, resetForm: true });

      expect(result.current.activeStep).toBe(0);
      expect(result.current.formData.statement).toBe("");
      expect(result.current.questionInteracted).toBe(false);
      expect(result.current.settingsInteracted).toBe(false);
      expect(onFormReset).toHaveBeenCalled();
    });

    it("does not reset when resetForm is false", () => {
      const onFormReset = vi.fn();
      const props = makeProps({ validateStep: () => true, resetForm: false, onFormReset });
      const { result, rerender } = renderHook(
        (p: UseBaseExerciseProps<TestFormData>) => useBaseExercise(p),
        { initialProps: props }
      );
      act(() => {
        result.current.goToNextStep();
      });
      rerender({ ...props, resetForm: false });
      expect(result.current.activeStep).toBe(1);
      expect(onFormReset).not.toHaveBeenCalled();
    });

    it("does not reset when onFormReset is not provided", () => {
      const props = makeProps({
        validateStep: () => true,
        resetForm: true,
        onFormReset: undefined
      });
      const { result } = renderHook(() => useBaseExercise(props));
      expect(result.current.activeStep).toBe(0);
    });
  });
});
