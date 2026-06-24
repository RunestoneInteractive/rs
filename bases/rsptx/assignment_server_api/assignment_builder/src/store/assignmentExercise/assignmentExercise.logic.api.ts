import { createApi } from "@reduxjs/toolkit/query/react";
import { assignmentApi } from "@store/assignment/assignment.logic.api";
import { assignmentExerciseActions } from "@store/assignmentExercise/assignmentExercise.logic";
import { baseQuery } from "@store/baseQuery";
import { chooseExercisesActions } from "@store/chooseExercises/chooseExercises.logic";
import { notify } from "@components/ui/notify";

import { RootState } from "@/state/store";
import { DetailResponse } from "@/types/api";
import { CreateAssignmentExercisePayload } from "@/types/assignment";
import {
  Exercise,
  GetExercisesResponse,
  UpdateAssignmentExercisePayload,
  UpdateAssignmentExercisesPayload
} from "@/types/exercises";
import { getSelectedKeys } from "@/utils/exercise";

export const ASSIGNMENT_EXERCISE_TOAST_COPY = {
  loadExercisesError: "Couldn't load exercises. Refresh the page.",
  updateExercisesError: "Couldn't update exercises. Try again.",
  reorderError: "Couldn't reorder exercises. Try again.",
  createError: "Couldn't create exercise. Try again.",
  copyError: "Couldn't copy exercise. Try again."
} as const;

export const assignmentExerciseApi = createApi({
  reducerPath: "assignmentExerciseAPI",
  keepUnusedDataFor: 60, //change to 0 for tests,
  baseQuery: baseQuery,
  tagTypes: ["Assignments", "Exercises"],
  endpoints: (build) => ({
    getExercises: build.query<Exercise[], number>({
      query: (assignment) => ({
        method: "POST",
        url: "/assignment/instructor/assignment_questions",
        body: { assignment }
      }),
      providesTags: ["Exercises"],
      transformResponse: (response: DetailResponse<GetExercisesResponse>) => {
        return response.detail.exercises;
      },
      onQueryStarted: (assignment, { queryFulfilled, dispatch, getState }) => {
        queryFulfilled
          .then(({ data }) => {
            const state = getState() as RootState;

            dispatch(
              assignmentExerciseActions.setAssignmentExercisesForAssignment({
                assignmentId: assignment,
                exercises: data
              })
            );
            dispatch(
              chooseExercisesActions.setSelectedKeys(
                getSelectedKeys(state.exercises.availableExercises, data)
              )
            );
            dispatch(chooseExercisesActions.setSelectedExercises(data));
            dispatch(chooseExercisesActions.resetSelections());
          })
          .catch(() => {
            notify.error(ASSIGNMENT_EXERCISE_TOAST_COPY.loadExercisesError);
          });
      }
    }),
    updateAssignmentQuestions: build.mutation<void, UpdateAssignmentExercisePayload[]>({
      query: (body) => ({
        method: "PUT",
        url: "/assignment/instructor/assignment_question/batch",
        body
      }),
      invalidatesTags: (_, error) => {
        if (!error) {
          return [{ type: "Exercises" }];
        }
        return [];
      },
      onQueryStarted: (_, { queryFulfilled, dispatch, getState }) => {
        queryFulfilled
          .then(() => {
            const state = getState() as RootState;

            dispatch(assignmentApi.util.invalidateTags(["Assignment"]));

            dispatch(
              assignmentApi.endpoints.getAssignment.initiate(
                state.assignmentTemp.selectedAssignmentId!
              )
            );
          })
          .catch(() => {
            notify.error(ASSIGNMENT_EXERCISE_TOAST_COPY.updateExercisesError);
          });
      }
    }),
    removeAssignmentExercises: build.mutation<void, number[]>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/remove_assignment_questions",
        body
      }),
      invalidatesTags: (_, error) => {
        if (!error) {
          return [{ type: "Exercises" }];
        }
        return [];
      }
    }),
    reorderAssignmentExercises: build.mutation<void, number[]>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/reorder_assignment_questions",
        body
      }),
      invalidatesTags: (_, error) => {
        if (!error) {
          return [{ type: "Exercises" }];
        }
        return [];
      },
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          notify.error(ASSIGNMENT_EXERCISE_TOAST_COPY.reorderError);
        });
      }
    }),
    createAssignmentExercise: build.mutation<void, CreateAssignmentExercisePayload>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/new_assignment_q",
        body
      }),
      invalidatesTags: (_, error) => {
        if (!error) {
          return [{ type: "Exercises" }];
        }
        return [];
      },
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          notify.error(ASSIGNMENT_EXERCISE_TOAST_COPY.createError);
        });
      }
    }),
    updateAssignmentExercises: build.mutation<void, UpdateAssignmentExercisesPayload>({
      query: (body) => ({
        method: "PUT",
        url: "/assignment/instructor/assignment_exercises",
        body
      }),
      invalidatesTags: (_, error) => {
        if (!error) {
          return ["Exercises"];
        }
        return [];
      },
      onQueryStarted: (_, { queryFulfilled, dispatch, getState }) => {
        queryFulfilled
          .then(() => {
            const state = getState() as RootState;

            dispatch(assignmentApi.util.invalidateTags(["Assignment", "Assignments"]));

            dispatch(
              assignmentApi.endpoints.getAssignment.initiate(
                state.assignmentTemp.selectedAssignmentId!
              )
            );
          })
          .catch(() => {
            notify.error(ASSIGNMENT_EXERCISE_TOAST_COPY.updateExercisesError);
          });
      }
    }),
    validateQuestionName: build.mutation<DetailResponse<{ is_unique: boolean }>, { name: string }>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/validate_question_name",
        body
      })
    }),
    hasApiKey: build.query<{ hasApiKey: boolean; asyncLlmModesEnabled: boolean }, void>({
      query: () => ({
        method: "GET",
        url: "/assignment/instructor/has_api_key"
      }),
      transformResponse: (
        response: DetailResponse<{ has_api_key: boolean; async_llm_modes_enabled: boolean }>
      ) => ({
        hasApiKey: response.detail.has_api_key,
        asyncLlmModesEnabled: response.detail.async_llm_modes_enabled
      })
    }),
    copyQuestion: build.mutation<
      DetailResponse<{ status: string; question_id: number; message: string }>,
      {
        original_question_id: number;
        new_name: string;
        assignment_id?: number;
        copy_to_assignment: boolean;
        htmlsrc?: string;
      }
    >({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/copy_question",
        body
      }),
      invalidatesTags: (_, error) => {
        if (!error) {
          return ["Exercises"];
        }
        return [];
      },
      onQueryStarted: (_, { queryFulfilled, dispatch, getState }) => {
        queryFulfilled
          .then(() => {
            const state = getState() as RootState;

            dispatch(assignmentApi.util.invalidateTags(["Assignment"]));

            if (state.assignmentTemp.selectedAssignmentId) {
              dispatch(
                assignmentApi.endpoints.getAssignment.initiate(
                  state.assignmentTemp.selectedAssignmentId
                )
              );
            }
          })
          .catch(() => {
            notify.error(ASSIGNMENT_EXERCISE_TOAST_COPY.copyError);
          });
      }
    })
  })
});

export const {
  useGetExercisesQuery,
  useUpdateAssignmentQuestionsMutation,
  useRemoveAssignmentExercisesMutation,
  useReorderAssignmentExercisesMutation,
  useUpdateAssignmentExercisesMutation,
  useValidateQuestionNameMutation,
  useCopyQuestionMutation,
  useHasApiKeyQuery
} = assignmentExerciseApi;
