import { configureStore } from "@reduxjs/toolkit";
import { assignmentApi } from "@/store/assignment/assignment.logic.api";
import { baseQuery } from "@/store/baseQuery";
import type { Assignment } from "@/types/assignment";
import {
  graderApi,
  useGetGraderQuestionsQuery,
  useGetGraderAnswersQuery,
  useGetGraderHistoryQuery,
  useSaveGradeMutation,
  useRegradePreviewMutation,
  useRegradeMutation,
  useGetAccommodationsQuery,
  useUpsertAccommodationMutation,
  useDeleteAccommodationMutation,
  useGetCourseRosterQuery,
  useRecomputeTotalsMutation,
  useSetAssignmentReleasedMutation,
  useSetAssignmentThresholdMutation,
  useGetGradebookQuery,
  useSetManualTotalMutation,
  GRADEBOOK_CSV_URL,
  gradebookCsvFilename
} from "./grader.logic.api";
import type {
  GraderQuestionsResponse,
  GraderAnswersResponse,
  GraderHistoryResponse,
  RegradeReport,
  RegradeRequest,
  Accommodation,
  RosterStudent,
  RegradeDiffItem,
  GradebookResponse,
  SetManualTotalRequest,
  SetManualTotalResponse
} from "./grader.logic.api";
import type { DetailResponse } from "@/types/api";

vi.mock("@/store/baseQuery", () => ({
  baseQuery: vi.fn()
}));

function buildStore() {
  return configureStore({
    reducer: {
      [graderApi.reducerPath]: graderApi.reducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(graderApi.middleware)
  });
}

describe("graderApi module exports", () => {
  it("exports the graderApi object", () => {
    expect(graderApi).toBeDefined();
  });

  it("has the correct reducerPath", () => {
    expect(graderApi.reducerPath).toBe("graderApi");
  });

  it("exports all query hooks", () => {
    expect(typeof useGetGraderQuestionsQuery).toBe("function");
    expect(typeof useGetGraderAnswersQuery).toBe("function");
    expect(typeof useGetGraderHistoryQuery).toBe("function");
    expect(typeof useGetAccommodationsQuery).toBe("function");
    expect(typeof useGetCourseRosterQuery).toBe("function");
  });

  it("exports all mutation hooks", () => {
    expect(typeof useSaveGradeMutation).toBe("function");
    expect(typeof useRegradePreviewMutation).toBe("function");
    expect(typeof useRegradeMutation).toBe("function");
    expect(typeof useUpsertAccommodationMutation).toBe("function");
    expect(typeof useDeleteAccommodationMutation).toBe("function");
    expect(typeof useRecomputeTotalsMutation).toBe("function");
  });

  it("exposes the expected endpoint names", () => {
    const endpointNames = Object.keys(graderApi.endpoints);
    expect(endpointNames).toContain("getGraderQuestions");
    expect(endpointNames).toContain("getGraderAnswers");
    expect(endpointNames).toContain("getGraderHistory");
    expect(endpointNames).toContain("saveGrade");
    expect(endpointNames).toContain("regradePreview");
    expect(endpointNames).toContain("regrade");
    expect(endpointNames).toContain("getAccommodations");
    expect(endpointNames).toContain("upsertAccommodation");
    expect(endpointNames).toContain("deleteAccommodation");
    expect(endpointNames).toContain("getCourseRoster");
    expect(endpointNames).toContain("recomputeTotals");
  });

  it("reducer returns a defined initial state", () => {
    const state = graderApi.reducer(undefined, { type: "@@INIT" });
    expect(state).toBeDefined();
    expect(typeof state).toBe("object");
  });
});

describe("graderApi store integration", () => {
  it("mounts its reducer in a combined store without errors", () => {
    expect(() => buildStore()).not.toThrow();
  });

  it("initial graderApi state has a queries key", () => {
    const store = buildStore();
    const apiState = store.getState()[graderApi.reducerPath];
    expect(apiState).toHaveProperty("queries");
  });

  it("initial graderApi state has a mutations key", () => {
    const store = buildStore();
    const apiState = store.getState()[graderApi.reducerPath];
    expect(apiState).toHaveProperty("mutations");
  });

  it("initial queries state is an empty object", () => {
    const store = buildStore();
    const apiState = store.getState()[graderApi.reducerPath];
    expect(apiState.queries).toEqual({});
  });
});

describe("graderApi endpoint definitions", () => {
  it("getGraderQuestions endpoint has a select method", () => {
    const endpoint = graderApi.endpoints.getGraderQuestions;
    expect(typeof (endpoint as any).select).toBe("function");
  });

  it("getGraderAnswers endpoint has a select method", () => {
    const endpoint = graderApi.endpoints.getGraderAnswers;
    expect(typeof (endpoint as any).select).toBe("function");
  });

  it("getGraderHistory endpoint has a select method", () => {
    const endpoint = graderApi.endpoints.getGraderHistory;
    expect(typeof (endpoint as any).select).toBe("function");
  });

  it("saveGrade endpoint has a select method", () => {
    const endpoint = graderApi.endpoints.saveGrade;
    expect(typeof (endpoint as any).select).toBe("function");
  });

  it("regrade endpoint has a select method", () => {
    const endpoint = graderApi.endpoints.regrade;
    expect(typeof (endpoint as any).select).toBe("function");
  });
});

describe("getGraderQuestions transformResponse", () => {
  const mockAssignment = { id: 1, name: "Assignment 1" };
  const mockQuestions = [
    {
      id: 10,
      name: "q1",
      question_type: "mchoice",
      points: 5,
      answered_count: 20,
      correct_count: 15,
      average_score: 3.5
    }
  ];

  it("extracts detail from wrapped response", () => {
    const response: DetailResponse<GraderQuestionsResponse> = {
      detail: { assignment: mockAssignment, questions: mockQuestions }
    };
    const result = response.detail;
    expect(result.assignment).toEqual(mockAssignment);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].id).toBe(10);
  });

  it("preserves question stats fields", () => {
    const response: DetailResponse<GraderQuestionsResponse> = {
      detail: { assignment: mockAssignment, questions: mockQuestions }
    };
    const q = response.detail.questions[0];
    expect(q.answered_count).toBe(20);
    expect(q.correct_count).toBe(15);
    expect(q.average_score).toBe(3.5);
  });
});

describe("getGraderAnswers transformResponse", () => {
  const mockAnswersResponse: GraderAnswersResponse = {
    question: {
      id: 10,
      name: "q1",
      question_type: "mchoice",
      max_points: 5
    },
    answers: [
      {
        sid: "student1",
        answer: "A",
        attempts: 1,
        max_points: 5,
        score: 5,
        correct: true
      },
      {
        sid: "student2",
        answer: "B",
        attempts: 2,
        max_points: 5,
        score: null,
        correct: false
      }
    ]
  };

  it("extracts answers from detail wrapper", () => {
    const response: DetailResponse<GraderAnswersResponse> = {
      detail: mockAnswersResponse
    };
    const result = response.detail;
    expect(result.answers).toHaveLength(2);
    expect(result.answers[0].sid).toBe("student1");
  });

  it("preserves null score for ungraded answers", () => {
    const response: DetailResponse<GraderAnswersResponse> = {
      detail: mockAnswersResponse
    };
    const ungraded = response.detail.answers.find((a) => a.sid === "student2");
    expect(ungraded?.score).toBeNull();
  });

  it("preserves question metadata", () => {
    const response: DetailResponse<GraderAnswersResponse> = {
      detail: mockAnswersResponse
    };
    expect(response.detail.question.max_points).toBe(5);
    expect(response.detail.question.question_type).toBe("mchoice");
  });
});

describe("getGraderHistory transformResponse", () => {
  it("extracts history and useinfo from detail wrapper", () => {
    const response: DetailResponse<GraderHistoryResponse> = {
      detail: {
        history: [{ id: 1, answer: "A", correct: true, timestamp: "2026-01-01T10:00:00" }],
        useinfo: [{ id: 1, event: "mchoice", act: "A", timestamp: "2026-01-01T10:00:00" }]
      }
    };
    const result = response.detail;
    expect(result.history).toHaveLength(1);
    expect(result.useinfo).toHaveLength(1);
    expect(result.history[0].answer).toBe("A");
  });

  it("handles answer as an object", () => {
    const response: DetailResponse<GraderHistoryResponse> = {
      detail: {
        history: [{ id: 2, answer: { key: "value" }, correct: null }],
        useinfo: []
      }
    };
    const historyItem = response.detail.history[0];
    expect(historyItem.answer).toEqual({ key: "value" });
    expect(historyItem.correct).toBeNull();
  });

  it("handles null answer", () => {
    const response: DetailResponse<GraderHistoryResponse> = {
      detail: {
        history: [{ id: 3, answer: null }],
        useinfo: []
      }
    };
    expect(response.detail.history[0].answer).toBeNull();
  });
});

describe("getCourseRoster transformResponse", () => {
  it("extracts students array from detail wrapper", () => {
    const students: RosterStudent[] = [
      { username: "alice", first_name: "Alice", last_name: "Smith" },
      { username: "bob", first_name: "Bob", last_name: "Jones" }
    ];
    const response: DetailResponse<{ students: RosterStudent[] }> = {
      detail: { students }
    };
    const result = response.detail.students ?? [];
    expect(result).toHaveLength(2);
    expect(result[0].username).toBe("alice");
  });

  it("returns empty array when students is undefined", () => {
    const response: DetailResponse<{ students: RosterStudent[] }> = {
      detail: { students: [] }
    };
    const result = response.detail.students ?? [];
    expect(result).toEqual([]);
  });
});

describe("getAccommodations transformResponse", () => {
  const mockAccommodation: Accommodation = {
    row_id: 1,
    course_id: 100,
    sid: "student1",
    time_limit: 60,
    duedate: null,
    visible: true,
    allowLink: null,
    assignment_id: null
  };

  it("extracts accommodations from detail wrapper", () => {
    const response: DetailResponse<{ accommodations: Accommodation[] }> = {
      detail: { accommodations: [mockAccommodation] }
    };
    const result = response.detail;
    expect(result.accommodations).toHaveLength(1);
    expect(result.accommodations[0].sid).toBe("student1");
  });

  it("handles empty accommodations list", () => {
    const response: DetailResponse<{ accommodations: Accommodation[] }> = {
      detail: { accommodations: [] }
    };
    expect(response.detail.accommodations).toEqual([]);
  });
});

describe("regradePreview and regrade transformResponse", () => {
  const mockReport: RegradeReport = {
    total: 10,
    changed: 3,
    skipped_manual: 2,
    no_submission: 1,
    errors: 0,
    items: [
      {
        sid: "student1",
        question_id: 10,
        div_id: "q1",
        old_score: 3,
        new_score: 5,
        skipped: null,
        error: null
      }
    ]
  };

  it("extracts RegradeReport from detail wrapper", () => {
    const response: DetailResponse<RegradeReport> = { detail: mockReport };
    const result = response.detail;
    expect(result.total).toBe(10);
    expect(result.changed).toBe(3);
    expect(result.skipped_manual).toBe(2);
    expect(result.no_submission).toBe(1);
    expect(result.errors).toBe(0);
  });

  it("preserves items array with diff details", () => {
    const response: DetailResponse<RegradeReport> = { detail: mockReport };
    const item = response.detail.items[0];
    expect(item.sid).toBe("student1");
    expect(item.old_score).toBe(3);
    expect(item.new_score).toBe(5);
    expect(item.skipped).toBeNull();
    expect(item.error).toBeNull();
  });

  it("handles empty items array", () => {
    const emptyReport: RegradeReport = {
      total: 0,
      changed: 0,
      skipped_manual: 0,
      no_submission: 0,
      errors: 0,
      items: []
    };
    const response: DetailResponse<RegradeReport> = { detail: emptyReport };
    expect(response.detail.items).toEqual([]);
  });
});

describe("regrade invalidatesTags logic", () => {
  it("invalidates GraderQuestions tag for given assignment_id", () => {
    const req: RegradeRequest = {
      assignment_id: 5,
      question_ids: [10, 20],
      sids: ["student1"]
    };
    const invalidatesTags = (_res: any, _err: any, r: RegradeRequest) => [
      { type: "GraderQuestions" as const, id: r.assignment_id },
      ...r.question_ids.map((id) => ({ type: "GraderAnswers" as const, id }))
    ];
    const tags = invalidatesTags({}, null, req);
    expect(tags).toContainEqual({ type: "GraderQuestions", id: 5 });
  });

  it("invalidates GraderAnswers tag for each question_id", () => {
    const req: RegradeRequest = {
      assignment_id: 5,
      question_ids: [10, 20],
      sids: ["student1"]
    };
    const invalidatesTags = (_res: any, _err: any, r: RegradeRequest) => [
      { type: "GraderQuestions" as const, id: r.assignment_id },
      ...r.question_ids.map((id) => ({ type: "GraderAnswers" as const, id }))
    ];
    const tags = invalidatesTags({}, null, req);
    expect(tags).toContainEqual({ type: "GraderAnswers", id: 10 });
    expect(tags).toContainEqual({ type: "GraderAnswers", id: 20 });
    expect(tags).toHaveLength(3);
  });

  it("produces only GraderQuestions tag when question_ids is empty", () => {
    const req: RegradeRequest = {
      assignment_id: 7,
      question_ids: [],
      sids: []
    };
    const invalidatesTags = (_res: any, _err: any, r: RegradeRequest) => [
      { type: "GraderQuestions" as const, id: r.assignment_id },
      ...r.question_ids.map((id) => ({ type: "GraderAnswers" as const, id }))
    ];
    const tags = invalidatesTags({}, null, req);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toEqual({ type: "GraderQuestions", id: 7 });
  });
});

describe("recomputeTotals transformResponse and invalidatesTags", () => {
  it("extracts result from detail wrapper", () => {
    const response: DetailResponse<{ assignment_id: number; students: number }> = {
      detail: { assignment_id: 3, students: 25 }
    };
    const result = response.detail;
    expect(result.assignment_id).toBe(3);
    expect(result.students).toBe(25);
  });

  it("invalidates GraderQuestions tag for given assignment_id", () => {
    const req = { assignment_id: 3, sids: ["s1", "s2"] };
    const invalidatesTags = (_res: any, _err: any, r: typeof req) => [
      { type: "GraderQuestions" as const, id: r.assignment_id }
    ];
    const tags = invalidatesTags({}, null, req);
    expect(tags).toEqual([{ type: "GraderQuestions", id: 3 }]);
  });
});

describe("getGraderAnswers query builder", () => {
  it("builds URL with both assignmentId and questionId as query params", () => {
    const queryFn = ({
      assignmentId,
      questionId
    }: {
      assignmentId: number;
      questionId: number;
    }) => ({
      method: "GET",
      url: `/assignment/instructor/grader/questions/answers?assignment_id=${assignmentId}&question_id=${questionId}`
    });
    const result = queryFn({ assignmentId: 1, questionId: 10 });
    expect(result.url).toBe(
      "/assignment/instructor/grader/questions/answers?assignment_id=1&question_id=10"
    );
    expect(result.method).toBe("GET");
  });
});

describe("getGraderHistory query builder", () => {
  it("URL-encodes the sid parameter", () => {
    const sid = "user@example.com";
    const queryFn = ({
      assignmentId,
      questionId,
      sid
    }: {
      assignmentId: number;
      questionId: number;
      sid: string;
    }) => ({
      method: "GET",
      url: `/assignment/instructor/grader/questions/history?assignment_id=${assignmentId}&question_id=${questionId}&sid=${encodeURIComponent(sid)}`
    });
    const result = queryFn({ assignmentId: 1, questionId: 10, sid });
    expect(result.url).toContain("sid=user%40example.com");
  });

  it("passes plain sid without special chars unchanged", () => {
    const queryFn = ({
      assignmentId,
      questionId,
      sid
    }: {
      assignmentId: number;
      questionId: number;
      sid: string;
    }) => ({
      method: "GET",
      url: `/assignment/instructor/grader/questions/history?assignment_id=${assignmentId}&question_id=${questionId}&sid=${encodeURIComponent(sid)}`
    });
    const result = queryFn({ assignmentId: 2, questionId: 20, sid: "student1" });
    expect(result.url).toContain("sid=student1");
  });
});

describe("deleteAccommodation query builder", () => {
  it("builds DELETE URL with accommodation id", () => {
    const queryFn = (id: number) => ({
      method: "DELETE",
      url: `/assignment/instructor/accommodation/${id}`
    });
    const result = queryFn(42);
    expect(result.method).toBe("DELETE");
    expect(result.url).toBe("/assignment/instructor/accommodation/42");
  });
});

describe("GraderStudentAnswer optional fields", () => {
  it("allows null values for optional scored fields", () => {
    const answer = {
      sid: "s1",
      answer: "",
      attempts: 0,
      max_points: 10,
      score: null,
      correct: null,
      percent: null,
      comment: null
    };
    expect(answer.score).toBeNull();
    expect(answer.correct).toBeNull();
    expect(answer.percent).toBeNull();
    expect(answer.comment).toBeNull();
  });
});

describe("RegradeRequest optional fields", () => {
  it("allows partial override fields to be undefined", () => {
    const req: RegradeRequest = {
      assignment_id: 1,
      question_ids: [10],
      sids: ["s1"]
    };
    expect(req.overwrite_manual).toBeUndefined();
    expect(req.enforce_deadline).toBeUndefined();
    expect(req.recompute_totals).toBeUndefined();
    expect(req.which_to_grade_override).toBeUndefined();
  });

  it("accepts all optional override fields when provided", () => {
    const req: RegradeRequest = {
      assignment_id: 1,
      question_ids: [10],
      sids: ["s1"],
      overwrite_manual: true,
      enforce_deadline: false,
      recompute_totals: true,
      which_to_grade_override: "best_answer"
    };
    expect(req.overwrite_manual).toBe(true);
    expect(req.enforce_deadline).toBe(false);
    expect(req.recompute_totals).toBe(true);
    expect(req.which_to_grade_override).toBe("best_answer");
  });
});

describe("setAssignmentReleased", () => {
  it("is exported as a mutation hook", () => {
    expect(typeof useSetAssignmentReleasedMutation).toBe("function");
  });

  it("is registered as an endpoint", () => {
    expect(Object.keys(graderApi.endpoints)).toContain("setAssignmentReleased");
  });

  it("builds a POST to the release endpoint with the body", () => {
    const queryFn = (body: { assignment_id: number; released: boolean }) => ({
      method: "POST",
      url: "/assignment/instructor/grader/release",
      body
    });
    const result = queryFn({ assignment_id: 7, released: true });
    expect(result.method).toBe("POST");
    expect(result.url).toBe("/assignment/instructor/grader/release");
    expect(result.body).toEqual({ assignment_id: 7, released: true });
  });

  it("extracts detail from the wrapped response", () => {
    const response: DetailResponse<{ assignment_id: number; released: boolean }> = {
      detail: { assignment_id: 7, released: true }
    };
    expect(response.detail).toEqual({ assignment_id: 7, released: true });
  });

  function buildFullStore() {
    return configureStore({
      reducer: {
        [graderApi.reducerPath]: graderApi.reducer,
        [assignmentApi.reducerPath]: assignmentApi.reducer
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(graderApi.middleware, assignmentApi.middleware)
    });
  }

  async function primeAssignments(store: ReturnType<typeof buildFullStore>) {
    await store.dispatch(assignmentApi.endpoints.getAssignments.initiate());
  }

  function releasedInCache(store: ReturnType<typeof buildFullStore>): boolean | undefined {
    const entries = Object.values(
      store.getState()[assignmentApi.reducerPath].queries
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as Array<{ endpointName?: string; data?: any }>;
    const list = entries.find((e) => e.endpointName === "getAssignments")?.data as
      | Assignment[]
      | undefined;
    return list?.find((a) => a.id === 42)?.released;
  }

  it("optimistically flips released in the getAssignments cache and persists on success", async () => {
    let released = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (baseQuery as any).mockImplementation((args: any) => {
      if (typeof args === "object" && args.url?.endsWith("/grader/release")) {
        released = args.body.released;
        return {
          data: { detail: { assignment_id: args.body.assignment_id, released: args.body.released } }
        };
      }
      return {
        data: { detail: { assignments: [{ id: 42, name: "Quiz 1", released }] } }
      };
    });

    const store = buildFullStore();
    await primeAssignments(store);
    expect(releasedInCache(store)).toBe(false);

    await store
      .dispatch(
        graderApi.endpoints.setAssignmentReleased.initiate({ assignment_id: 42, released: true })
      )
      .unwrap();

    expect(releasedInCache(store)).toBe(true);
  });

  it("undoes the optimistic update when the request fails", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (baseQuery as any).mockImplementation((args: any) => {
      if (typeof args === "object" && args.url?.endsWith("/grader/release")) {
        return { error: { status: 500, data: "boom" } };
      }
      return { data: { detail: { assignments: [{ id: 42, name: "Quiz 1", released: false }] } } };
    });

    const store = buildFullStore();
    await primeAssignments(store);
    expect(releasedInCache(store)).toBe(false);

    await expect(
      store
        .dispatch(
          graderApi.endpoints.setAssignmentReleased.initiate({ assignment_id: 42, released: true })
        )
        .unwrap()
    ).rejects.toBeDefined();

    expect(releasedInCache(store)).toBe(false);
  });
});

describe("setAssignmentThreshold", () => {
  it("is exported as a mutation hook", () => {
    expect(typeof useSetAssignmentThresholdMutation).toBe("function");
  });

  it("is registered as an endpoint", () => {
    expect(Object.keys(graderApi.endpoints)).toContain("setAssignmentThreshold");
  });

  it("builds a POST to the threshold endpoint with the body", () => {
    const queryFn = (body: { assignment_id: number; threshold_pct: number | null }) => ({
      method: "POST",
      url: "/assignment/instructor/grader/threshold",
      body
    });
    const result = queryFn({ assignment_id: 7, threshold_pct: 0.9 });
    expect(result.method).toBe("POST");
    expect(result.url).toBe("/assignment/instructor/grader/threshold");
    expect(result.body).toEqual({ assignment_id: 7, threshold_pct: 0.9 });
  });

  it("extracts detail from the wrapped response", () => {
    const response: DetailResponse<{ assignment_id: number; threshold_pct: number | null }> = {
      detail: { assignment_id: 7, threshold_pct: 0.9 }
    };
    expect(response.detail).toEqual({ assignment_id: 7, threshold_pct: 0.9 });
  });

  function buildFullStore() {
    return configureStore({
      reducer: {
        [graderApi.reducerPath]: graderApi.reducer,
        [assignmentApi.reducerPath]: assignmentApi.reducer
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(graderApi.middleware, assignmentApi.middleware)
    });
  }

  function thresholdInCache(store: ReturnType<typeof buildFullStore>): number | null | undefined {
    const entries = Object.values(
      store.getState()[assignmentApi.reducerPath].queries
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as Array<{ endpointName?: string; data?: any }>;
    const list = entries.find((e) => e.endpointName === "getAssignments")?.data as
      | Assignment[]
      | undefined;
    return list?.find((a) => a.id === 42)?.threshold_pct;
  }

  it("optimistically patches threshold_pct in the getAssignments cache and persists on success", async () => {
    let threshold: number | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (baseQuery as any).mockImplementation((args: any) => {
      if (typeof args === "object" && args.url?.endsWith("/grader/threshold")) {
        threshold = args.body.threshold_pct;
        return {
          data: {
            detail: {
              assignment_id: args.body.assignment_id,
              threshold_pct: args.body.threshold_pct
            }
          }
        };
      }
      return {
        data: { detail: { assignments: [{ id: 42, name: "Quiz 1", threshold_pct: threshold }] } }
      };
    });

    const store = buildFullStore();
    await store.dispatch(assignmentApi.endpoints.getAssignments.initiate());
    expect(thresholdInCache(store)).toBeNull();

    await store
      .dispatch(
        graderApi.endpoints.setAssignmentThreshold.initiate({
          assignment_id: 42,
          threshold_pct: 0.9
        })
      )
      .unwrap();

    expect(thresholdInCache(store)).toBe(0.9);
  });

  it("undoes the optimistic update when the request fails", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (baseQuery as any).mockImplementation((args: any) => {
      if (typeof args === "object" && args.url?.endsWith("/grader/threshold")) {
        return { error: { status: 500, data: "boom" } };
      }
      return {
        data: { detail: { assignments: [{ id: 42, name: "Quiz 1", threshold_pct: null }] } }
      };
    });

    const store = buildFullStore();
    await store.dispatch(assignmentApi.endpoints.getAssignments.initiate());
    expect(thresholdInCache(store)).toBeNull();

    await expect(
      store
        .dispatch(
          graderApi.endpoints.setAssignmentThreshold.initiate({
            assignment_id: 42,
            threshold_pct: 0.9
          })
        )
        .unwrap()
    ).rejects.toBeDefined();

    expect(thresholdInCache(store)).toBeNull();
  });
});

describe("getGradebook", () => {
  it("exports the useGetGradebookQuery hook", () => {
    expect(typeof useGetGradebookQuery).toBe("function");
  });

  it("defines the getGradebook query endpoint", () => {
    expect(graderApi.endpoints.getGradebook).toBeDefined();
  });

  it("builds the gradebook URL", () => {
    const queryFn = () => ({
      method: "GET",
      url: "/assignment/instructor/grader/gradebook/data"
    });
    const result = queryFn();
    expect(result.url).toBe("/assignment/instructor/grader/gradebook/data");
    expect(result.method).toBe("GET");
  });

  it("extracts the matrix detail from the wrapped response", () => {
    const response: DetailResponse<GradebookResponse> = {
      detail: {
        assignments: [{ id: 1, name: "A1", points: 10, duedate: null, released: true }],
        students: [{ sid: "s1", name: "Stu One" }],
        cells: [{ sid: "s1", assignment_id: 1, score: 8, released: true }],
        averages: { "1": 8 }
      }
    };
    const result = response.detail;
    expect(result.assignments[0].name).toBe("A1");
    expect(result.students[0].sid).toBe("s1");
    expect(result.cells[0].score).toBe(8);
    expect(result.averages["1"]).toBe(8);
  });
});

describe("gradebook CSV helpers", () => {
  it("exposes the CSV endpoint URL", () => {
    expect(GRADEBOOK_CSV_URL).toBe("/assignment/instructor/grader/gradebook.csv");
  });

  it("builds a dated, sanitized filename", () => {
    const name = gradebookCsvFilename("My Course!", new Date("2026-06-13T12:00:00Z"));
    expect(name).toBe("gradebook-My-Course--2026-06-13.csv");
  });

  it("falls back to a default course slug", () => {
    const name = gradebookCsvFilename("", new Date("2026-01-02T00:00:00Z"));
    expect(name).toBe("gradebook-course-2026-01-02.csv");
  });
});

describe("setManualTotal", () => {
  it("exports the useSetManualTotalMutation hook", () => {
    expect(typeof useSetManualTotalMutation).toBe("function");
  });

  it("defines the setManualTotal endpoint", () => {
    expect(graderApi.endpoints.setManualTotal).toBeDefined();
    expect(Object.keys(graderApi.endpoints)).toContain("setManualTotal");
  });

  it("builds the override POST request body", () => {
    const queryFn = (body: SetManualTotalRequest) => ({
      method: "POST",
      url: "/assignment/instructor/grader/manual_total",
      body
    });
    const result = queryFn({ assignment_id: 7, sid: "s1", score: 9, manual: true });
    expect(result.url).toBe("/assignment/instructor/grader/manual_total");
    expect(result.method).toBe("POST");
    expect(result.body).toEqual({ assignment_id: 7, sid: "s1", score: 9, manual: true });
  });

  it("builds a revert request without a score", () => {
    const queryFn = (body: SetManualTotalRequest) => ({ body });
    const result = queryFn({ assignment_id: 7, sid: "s1", manual: false });
    expect(result.body.manual).toBe(false);
    expect(result.body.score).toBeUndefined();
  });

  it("extracts the response detail", () => {
    const response: DetailResponse<SetManualTotalResponse> = {
      detail: { assignment_id: 7, sid: "s1", score: 9, manual_total: true }
    };
    const result = response.detail;
    expect(result.manual_total).toBe(true);
    expect(result.score).toBe(9);
  });

  it("invalidates GraderQuestions for the assignment and the Gradebook", () => {
    const req: SetManualTotalRequest = { assignment_id: 7, sid: "s1", score: 9, manual: true };
    const invalidatesTags = (_res: unknown, _err: unknown, r: SetManualTotalRequest) => [
      { type: "GraderQuestions" as const, id: r.assignment_id },
      "Gradebook" as const
    ];
    const tags = invalidatesTags({}, null, req);
    expect(tags).toEqual([{ type: "GraderQuestions", id: 7 }, "Gradebook"]);
  });
});
