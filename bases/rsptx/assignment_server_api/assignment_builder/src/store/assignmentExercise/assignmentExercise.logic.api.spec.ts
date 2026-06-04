import { assignmentExerciseApi } from "./assignmentExercise.logic.api";

import type { Exercise } from "@/types/exercises";

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 1,
  assignment_id: 10,
  question_id: 100,
  points: 5,
  timed: false,
  autograde: "pct_correct",
  which_to_grade: "best_answer",
  reading_assignment: false,
  sorting_priority: 0,
  activities_required: 0,
  use_llm: false,
  qnumber: "q1",
  name: "question_one",
  subchapter: "sub1",
  chapter: "ch1",
  base_course: "course101",
  htmlsrc: "<p>html</p>",
  question_type: "mchoice",
  question_json: "{}",
  owner: "instructor",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Question One",
  topic: "topic1",
  difficulty: 1,
  author: "author1",
  description: "desc",
  is_private: false,
  from_source: true,
  ...overrides
});

describe("assignmentExerciseApi", () => {
  describe("api instance", () => {
    it("is created with the expected reducerPath", () => {
      expect(assignmentExerciseApi.reducerPath).toBe("assignmentExerciseAPI");
    });

    it("exposes expected endpoint names", () => {
      const endpointNames = Object.keys(assignmentExerciseApi.endpoints);
      expect(endpointNames).toContain("getExercises");
      expect(endpointNames).toContain("updateAssignmentQuestions");
      expect(endpointNames).toContain("removeAssignmentExercises");
      expect(endpointNames).toContain("reorderAssignmentExercises");
      expect(endpointNames).toContain("createAssignmentExercise");
      expect(endpointNames).toContain("updateAssignmentExercises");
      expect(endpointNames).toContain("validateQuestionName");
      expect(endpointNames).toContain("hasApiKey");
      expect(endpointNames).toContain("copyQuestion");
    });

    it("reducer returns non-null initial state", () => {
      const reducer = assignmentExerciseApi.reducer;
      const state = reducer(undefined, { type: "@@INIT" });
      expect(state).toBeDefined();
      expect(typeof state).toBe("object");
    });
  });

  describe("getExercises transformResponse", () => {
    const transformResponse = (assignmentExerciseApi.endpoints.getExercises as any)
      .select as unknown as undefined;

    it("extracts exercises array from detail wrapper", () => {
      const exercises: Exercise[] = [makeExercise({ id: 1 }), makeExercise({ id: 2, name: "q2" })];
      const response = { detail: { exercises } };

      const transform = (r: typeof response) => r.detail.exercises;
      expect(transform(response)).toEqual(exercises);
    });

    it("returns empty array when exercises list is empty", () => {
      const response = { detail: { exercises: [] } };
      const transform = (r: typeof response) => r.detail.exercises;
      expect(transform(response)).toEqual([]);
    });
  });

  describe("hasApiKey transformResponse", () => {
    it("maps has_api_key to hasApiKey and async_llm_modes_enabled to asyncLlmModesEnabled", () => {
      const rawResponse = {
        detail: { has_api_key: true, async_llm_modes_enabled: false }
      };

      const transform = (response: typeof rawResponse) => ({
        hasApiKey: response.detail.has_api_key,
        asyncLlmModesEnabled: response.detail.async_llm_modes_enabled
      });

      expect(transform(rawResponse)).toEqual({ hasApiKey: true, asyncLlmModesEnabled: false });
    });

    it("returns false values correctly when api key is absent", () => {
      const rawResponse = {
        detail: { has_api_key: false, async_llm_modes_enabled: true }
      };

      const transform = (response: typeof rawResponse) => ({
        hasApiKey: response.detail.has_api_key,
        asyncLlmModesEnabled: response.detail.async_llm_modes_enabled
      });

      expect(transform(rawResponse)).toEqual({ hasApiKey: false, asyncLlmModesEnabled: true });
    });
  });

  describe("invalidatesTags logic", () => {
    const noError = undefined;
    const withError = new Error("failed");

    describe("updateAssignmentQuestions", () => {
      it("returns Exercises tag when there is no error", () => {
        const invalidatesTags = (
          _result: unknown,
          error: unknown
        ): { type: string }[] | never[] => {
          if (!error) return [{ type: "Exercises" }];
          return [];
        };
        expect(invalidatesTags(undefined, noError)).toEqual([{ type: "Exercises" }]);
      });

      it("returns empty array when there is an error", () => {
        const invalidatesTags = (
          _result: unknown,
          error: unknown
        ): { type: string }[] | never[] => {
          if (!error) return [{ type: "Exercises" }];
          return [];
        };
        expect(invalidatesTags(undefined, withError)).toEqual([]);
      });
    });

    describe("removeAssignmentExercises", () => {
      it("returns Exercises tag when there is no error", () => {
        const invalidatesTags = (
          _result: unknown,
          error: unknown
        ): { type: string }[] | never[] => {
          if (!error) return [{ type: "Exercises" }];
          return [];
        };
        expect(invalidatesTags(undefined, noError)).toEqual([{ type: "Exercises" }]);
      });

      it("returns empty array when there is an error", () => {
        const invalidatesTags = (
          _result: unknown,
          error: unknown
        ): { type: string }[] | never[] => {
          if (!error) return [{ type: "Exercises" }];
          return [];
        };
        expect(invalidatesTags(undefined, withError)).toEqual([]);
      });
    });

    describe("updateAssignmentExercises", () => {
      it("returns Exercises string tag when there is no error", () => {
        const invalidatesTags = (_result: unknown, error: unknown): string[] | never[] => {
          if (!error) return ["Exercises"];
          return [];
        };
        expect(invalidatesTags(undefined, noError)).toEqual(["Exercises"]);
      });

      it("returns empty array when there is an error", () => {
        const invalidatesTags = (_result: unknown, error: unknown): string[] | never[] => {
          if (!error) return ["Exercises"];
          return [];
        };
        expect(invalidatesTags(undefined, withError)).toEqual([]);
      });
    });

    describe("copyQuestion", () => {
      it("returns Exercises tag when there is no error", () => {
        const invalidatesTags = (_result: unknown, error: unknown): string[] | never[] => {
          if (!error) return ["Exercises"];
          return [];
        };
        expect(invalidatesTags(undefined, noError)).toEqual(["Exercises"]);
      });

      it("returns empty array when there is an error", () => {
        const invalidatesTags = (_result: unknown, error: unknown): string[] | never[] => {
          if (!error) return ["Exercises"];
          return [];
        };
        expect(invalidatesTags(undefined, withError)).toEqual([]);
      });
    });
  });

  describe("exported hooks", () => {
    it("exports useGetExercisesQuery as a function", async () => {
      const mod = await import("./assignmentExercise.logic.api");
      expect(typeof mod.useGetExercisesQuery).toBe("function");
    });

    it("exports useUpdateAssignmentQuestionsMutation as a function", async () => {
      const mod = await import("./assignmentExercise.logic.api");
      expect(typeof mod.useUpdateAssignmentQuestionsMutation).toBe("function");
    });

    it("exports useRemoveAssignmentExercisesMutation as a function", async () => {
      const mod = await import("./assignmentExercise.logic.api");
      expect(typeof mod.useRemoveAssignmentExercisesMutation).toBe("function");
    });

    it("exports useReorderAssignmentExercisesMutation as a function", async () => {
      const mod = await import("./assignmentExercise.logic.api");
      expect(typeof mod.useReorderAssignmentExercisesMutation).toBe("function");
    });

    it("exports useUpdateAssignmentExercisesMutation as a function", async () => {
      const mod = await import("./assignmentExercise.logic.api");
      expect(typeof mod.useUpdateAssignmentExercisesMutation).toBe("function");
    });

    it("exports useValidateQuestionNameMutation as a function", async () => {
      const mod = await import("./assignmentExercise.logic.api");
      expect(typeof mod.useValidateQuestionNameMutation).toBe("function");
    });

    it("exports useCopyQuestionMutation as a function", async () => {
      const mod = await import("./assignmentExercise.logic.api");
      expect(typeof mod.useCopyQuestionMutation).toBe("function");
    });

    it("exports useHasApiKeyQuery as a function", async () => {
      const mod = await import("./assignmentExercise.logic.api");
      expect(typeof mod.useHasApiKeyQuery).toBe("function");
    });
  });
});

describe("ASSIGNMENT_EXERCISE_TOAST_COPY", () => {
  it("keeps every error message on the canonical shape", async () => {
    const { ASSIGNMENT_EXERCISE_TOAST_COPY } = await import("./assignmentExercise.logic.api");

    expect(ASSIGNMENT_EXERCISE_TOAST_COPY.loadExercisesError).toBe(
      "Couldn't load exercises. Refresh the page."
    );
    expect(ASSIGNMENT_EXERCISE_TOAST_COPY.updateExercisesError).toBe(
      "Couldn't update exercises. Try again."
    );
    expect(ASSIGNMENT_EXERCISE_TOAST_COPY.reorderError).toBe(
      "Couldn't reorder exercises. Try again."
    );
    expect(ASSIGNMENT_EXERCISE_TOAST_COPY.createError).toBe("Couldn't create exercise. Try again.");
    expect(ASSIGNMENT_EXERCISE_TOAST_COPY.copyError).toBe("Couldn't copy exercise. Try again.");
  });

  it("never says question, Error, or successfully", async () => {
    const { ASSIGNMENT_EXERCISE_TOAST_COPY } = await import("./assignmentExercise.logic.api");

    for (const message of Object.values(ASSIGNMENT_EXERCISE_TOAST_COPY)) {
      expect(message).not.toMatch(/question|Error|successfully/);
    }
  });
});
