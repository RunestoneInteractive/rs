import { createApi } from "@reduxjs/toolkit/query/react";

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

  answer: string | Record<string, any> | any[] | null;
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

export const graderApi = createApi({
  reducerPath: "graderApi",
  baseQuery,
  keepUnusedDataFor: 30,
  tagTypes: ["GraderQuestions", "GraderAnswers"],
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
      providesTags: (_res, _err, { questionId }) => [
        { type: "GraderAnswers", id: questionId }
      ],
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
      query: ({ questionId: _questionId, assignmentId: _assignmentId, ...body }) => ({
        method: "POST",
        url: "/assignment/instructor/grader/grade",
        body
      }),

      onQueryStarted: async (
        { sid, score, comment, questionId, assignmentId },
        { dispatch, queryFulfilled, getState }
      ) => {
        const state: any = getState();
        const cacheEntries = Object.values(
          state[graderApi.reducerPath]?.queries ?? {}
        ) as Array<{ endpointName?: string; originalArgs?: any }>;
        const matching = cacheEntries.filter(
          (e) =>
            e.endpointName === "getGraderAnswers" &&
            e.originalArgs?.questionId === questionId
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
              graderApi.util.invalidateTags([
                { type: "GraderQuestions", id: assignmentId }
              ])
            );
          }
        } catch {
          patches.forEach((p) => p.undo());
        }
      }
    })
  })
});

export const {
  useGetGraderQuestionsQuery,
  useGetGraderAnswersQuery,
  useGetGraderHistoryQuery,
  useSaveGradeMutation
} = graderApi;

