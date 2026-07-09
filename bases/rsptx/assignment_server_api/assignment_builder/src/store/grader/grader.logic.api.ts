import { createApi } from "@reduxjs/toolkit/query/react";

import { assignmentApi } from "@/store/assignment/assignment.logic.api";
import { baseQuery } from "@/store/baseQuery";
import { DetailResponse } from "@/types/api";

export interface GraderAssignment {
  id: number;
  name: string;
  description?: string;
  duedate?: string;
  points?: number;
}

export interface GraderQuestionStats {
  id: number;
  name: string;
  question_type: string;
  htmlsrc?: string;
  points: number;
  autograde?: string;
  which_to_grade?: string;

  answered_count: number;

  correct_count: number;

  graded_count?: number;

  average_score: number;

  avg_percent?: number | null;
}

export interface GraderStudentAnswer {
  sid: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  answer: string;
  correct?: boolean | null;
  percent?: number | null;
  timestamp?: string;
  attempts: number;
  score?: number | null;
  comment?: string | null;
  max_points: number;
}

export interface GraderAnswerHistoryItem {
  id: number;

  answer: string | Record<string, unknown> | unknown[] | null;
  correct?: boolean | null;
  percent?: number | null;
  timestamp?: string;
  source?: string | null;
}

export interface GraderUseinfoItem {
  id: number;
  timestamp?: string;
  event: string;
  act: string;
}

export interface GraderQuestionsResponse {
  assignment: GraderAssignment;
  questions: GraderQuestionStats[];
}

export interface GraderAnswersResponse {
  question: {
    id: number;
    name: string;
    question_type: string;
    htmlsrc?: string;
    max_points: number;
  };
  answers: GraderStudentAnswer[];
}

export interface GraderHistoryResponse {
  history: GraderAnswerHistoryItem[];
  useinfo: GraderUseinfoItem[];
}

export interface GraderSavePayload {
  sid: string;
  div_id: string;
  score: number;
  comment?: string;

  questionId: number;

  assignmentId: number;
}

export interface RegradeRequest {
  assignment_id: number;
  question_ids: number[];
  sids: string[];
  overwrite_manual?: boolean;
  enforce_deadline?: boolean;
  recompute_totals?: boolean;
  which_to_grade_override?: string | null;
}

export interface RegradeDiffItem {
  sid: string;
  question_id: number;
  div_id: string;
  old_score?: number | null;
  new_score?: number | null;
  skipped?: string | null;
  error?: string | null;
}

export interface RegradeReport {
  total: number;
  changed: number;
  skipped_manual: number;
  no_submission: number;
  errors: number;
  items: RegradeDiffItem[];
}

export interface AccommodationPayload {
  sids: string[];
  assignment_id?: number | null;
  duedate?: number | null;
  time_limit?: number | null;
  visible?: boolean | null;
  allowLink?: boolean | null;
}

export interface Accommodation {
  row_id: number;
  course_id: number;
  sid: string;
  time_limit?: number | null;
  duedate?: number | null;
  visible?: boolean | null;
  allowLink?: boolean | null;
  assignment_id?: string | null;
}

export interface RosterStudent {
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface RecomputeTotalsRequest {
  assignment_id: number;
  sids: string[];
}

export interface SetReleasedRequest {
  assignment_id: number;
  released: boolean;
}

export interface SetReleasedResponse {
  assignment_id: number;
  released: boolean;
}

export interface SetThresholdRequest {
  assignment_id: number;
  threshold_pct: number | null;
}

export interface SetThresholdResponse {
  assignment_id: number;
  threshold_pct: number | null;
}

export interface GradebookAssignment {
  id: number;
  name: string;
  points: number;
  duedate?: string | null;
  released: boolean;
}

export interface GradebookStudent {
  sid: string;
  name: string;
}

export interface GradebookCell {
  sid: string;
  assignment_id: number;
  score: number | null;
  released: boolean;
  manual_total?: boolean;
}

export interface GradebookResponse {
  assignments: GradebookAssignment[];
  students: GradebookStudent[];
  cells: GradebookCell[];
  averages: Record<string, number | null>;
}

export interface SetManualTotalRequest {
  assignment_id: number;
  sid: string;
  score?: number | null;
  manual: boolean;
}

export interface SetManualTotalResponse {
  assignment_id: number;
  sid: string;
  score: number | null;
  manual_total: boolean;
}

export const GRADEBOOK_CSV_URL = "/assignment/instructor/grader/gradebook.csv";

export const gradebookCsvFilename = (courseName: string, date: Date = new Date()): string => {
  const safe = (courseName || "course").replace(/[^a-zA-Z0-9_-]+/g, "-");
  const stamp = date.toISOString().slice(0, 10);
  return `gradebook-${safe}-${stamp}.csv`;
};

export const graderApi = createApi({
  reducerPath: "graderApi",
  baseQuery,
  keepUnusedDataFor: 30,
  tagTypes: ["GraderQuestions", "GraderAnswers", "Accommodations", "Gradebook"],
  endpoints: (build) => ({
    getGraderQuestions: build.query<GraderQuestionsResponse, number>({
      query: (assignmentId) => ({
        method: "GET",
        url: `/assignment/instructor/grader/assignments/${assignmentId}/questions`
      }),
      providesTags: (_res, _err, id) => [{ type: "GraderQuestions", id }],
      transformResponse: (r: DetailResponse<GraderQuestionsResponse>) => r.detail
    }),
    getGraderAnswers: build.query<
      GraderAnswersResponse,
      { assignmentId: number; questionId: number }
    >({
      query: ({ assignmentId, questionId }) => ({
        method: "GET",
        url: `/assignment/instructor/grader/questions/answers?assignment_id=${assignmentId}&question_id=${questionId}`
      }),
      providesTags: (_res, _err, { questionId }) => [{ type: "GraderAnswers", id: questionId }],
      transformResponse: (r: DetailResponse<GraderAnswersResponse>) => r.detail
    }),
    getGraderHistory: build.query<
      GraderHistoryResponse,
      { assignmentId: number; questionId: number; sid: string }
    >({
      query: ({ assignmentId, questionId, sid }) => ({
        method: "GET",
        url: `/assignment/instructor/grader/questions/history?assignment_id=${assignmentId}&question_id=${questionId}&sid=${encodeURIComponent(
          sid
        )}`
      }),
      transformResponse: (r: DetailResponse<GraderHistoryResponse>) => r.detail
    }),
    saveGrade: build.mutation<GraderSavePayload, GraderSavePayload>({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      query: ({ questionId: _questionId, assignmentId: _assignmentId, ...body }) => ({
        method: "POST",
        url: "/assignment/instructor/grader/grade",
        body
      }),

      onQueryStarted: async (
        { sid, score, comment, questionId, assignmentId },
        { dispatch, queryFulfilled, getState }
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state: any = getState();
        const cacheEntries = Object.values(
          state[graderApi.reducerPath]?.queries ?? {}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as Array<{ endpointName?: string; originalArgs?: any }>;
        const matching = cacheEntries.filter(
          (e) => e.endpointName === "getGraderAnswers" && e.originalArgs?.questionId === questionId
        );
        const patches = matching.map((entry) =>
          dispatch(
            graderApi.util.updateQueryData(
              "getGraderAnswers",
              entry.originalArgs as { assignmentId: number; questionId: number },
              (draft) => {
                const row = draft.answers.find((a) => a.sid === sid);
                if (row) {
                  row.score = score;
                  if (comment !== undefined) row.comment = comment;
                }
              }
            )
          )
        );
        try {
          await queryFulfilled;

          if (assignmentId) {
            dispatch(
              graderApi.util.invalidateTags([{ type: "GraderQuestions", id: assignmentId }])
            );
          }
        } catch {
          patches.forEach((p) => p.undo());
        }
      }
    }),
    regradePreview: build.mutation<RegradeReport, RegradeRequest>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/grader/regrade/preview",
        body
      }),
      transformResponse: (r: DetailResponse<RegradeReport>) => r.detail
    }),
    regrade: build.mutation<RegradeReport, RegradeRequest>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/grader/regrade",
        body
      }),
      transformResponse: (r: DetailResponse<RegradeReport>) => r.detail,
      invalidatesTags: (_res, _err, req) => [
        { type: "GraderQuestions", id: req.assignment_id },
        ...req.question_ids.map((id) => ({ type: "GraderAnswers" as const, id }))
      ]
    }),
    getAccommodations: build.query<{ accommodations: Accommodation[] }, void>({
      query: () => ({
        method: "GET",
        url: "/assignment/instructor/accommodations"
      }),
      providesTags: ["Accommodations"],
      transformResponse: (r: DetailResponse<{ accommodations: Accommodation[] }>) => r.detail
    }),
    upsertAccommodation: build.mutation<unknown, AccommodationPayload>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/accommodation",
        body
      }),
      invalidatesTags: ["Accommodations"]
    }),
    deleteAccommodation: build.mutation<unknown, number>({
      query: (id) => ({
        method: "DELETE",
        url: `/assignment/instructor/accommodation/${id}`
      }),
      invalidatesTags: ["Accommodations"]
    }),
    getCourseRoster: build.query<RosterStudent[], void>({
      query: () => ({
        method: "GET",
        url: "/assignment/instructor/course_roster"
      }),
      transformResponse: (r: DetailResponse<{ students: RosterStudent[] }>) =>
        r.detail.students ?? []
    }),
    recomputeTotals: build.mutation<
      { assignment_id: number; students: number },
      RecomputeTotalsRequest
    >({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/grader/recompute_totals",
        body
      }),
      transformResponse: (r: DetailResponse<{ assignment_id: number; students: number }>) =>
        r.detail,
      invalidatesTags: (_res, _err, req) => [
        { type: "GraderQuestions", id: req.assignment_id },
        "Gradebook"
      ]
    }),
    setAssignmentReleased: build.mutation<SetReleasedResponse, SetReleasedRequest>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/grader/release",
        body
      }),
      transformResponse: (r: DetailResponse<SetReleasedResponse>) => r.detail,
      onQueryStarted: async ({ assignment_id, released }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          assignmentApi.util.updateQueryData("getAssignments", undefined, (draft) => {
            const target = draft.find((a) => a.id === assignment_id);
            if (target) target.released = released;
          })
        );
        try {
          await queryFulfilled;
          dispatch(assignmentApi.util.invalidateTags([{ type: "Assignments" }]));
        } catch {
          patch.undo();
        }
      }
    }),
    setAssignmentThreshold: build.mutation<SetThresholdResponse, SetThresholdRequest>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/grader/threshold",
        body
      }),
      transformResponse: (r: DetailResponse<SetThresholdResponse>) => r.detail,
      onQueryStarted: async ({ assignment_id, threshold_pct }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          assignmentApi.util.updateQueryData("getAssignments", undefined, (draft) => {
            const target = draft.find((a) => a.id === assignment_id);
            if (target) target.threshold_pct = threshold_pct;
          })
        );
        try {
          await queryFulfilled;
          dispatch(assignmentApi.util.invalidateTags([{ type: "Assignments" }]));
          dispatch(graderApi.util.invalidateTags(["Gradebook"]));
        } catch {
          patch.undo();
        }
      }
    }),
    getGradebook: build.query<GradebookResponse, void>({
      query: () => ({
        method: "GET",
        url: "/assignment/instructor/grader/gradebook/data"
      }),
      providesTags: ["Gradebook"],
      transformResponse: (r: DetailResponse<GradebookResponse>) => r.detail
    }),
    setManualTotal: build.mutation<SetManualTotalResponse, SetManualTotalRequest>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/grader/manual_total",
        body
      }),
      transformResponse: (r: DetailResponse<SetManualTotalResponse>) => r.detail,
      invalidatesTags: (_res, _err, req) => [
        { type: "GraderQuestions", id: req.assignment_id },
        "Gradebook"
      ]
    })
  })
});

export const {
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
  useSetManualTotalMutation
} = graderApi;
