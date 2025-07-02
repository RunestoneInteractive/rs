import { createApi } from "@reduxjs/toolkit/query/react";
import { assignmentApi } from "@store/assignment/assignment.logic.api";
import { assignmentExerciseActions } from "@store/assignmentExercise/assignmentExercise.logic";
import { baseQuery } from "@store/baseQuery";
import { chooseExercisesActions } from "@store/chooseExercises/chooseExercises.logic";
import toast from "react-hot-toast";

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
      onQueryStarted: (_, { queryFulfilled, dispatch, getState }) => {
        queryFulfilled
          .then(({ data }) => {
            const state = getState() as RootState;

            dispatch(assignmentExerciseActions.setAssignmentExercises(data));
            dispatch(
              chooseExercisesActions.setSelectedKeys(
                getSelectedKeys(state.exercises.availableExercises, data)
              )
            );
            dispatch(chooseExercisesActions.setSelectedExercises(data));
            dispatch(chooseExercisesActions.resetSelections());
          })
          .catch(() => {
            toast("Unable to fetch exercises", {
              icon: "🔥"
            });
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
            toast("Error updating assignment exercises", {
              icon: "🔥"
            });
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
          toast("Error reordering assignment exercise", {
            icon: "🔥"
          });
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
          toast("Error creating assignment exercise", {
            icon: "🔥"
          });
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

            dispatch(assignmentApi.util.invalidateTags(["Assignment"]));

            dispatch(
              assignmentApi.endpoints.getAssignment.initiate(
                state.assignmentTemp.selectedAssignmentId!
              )
            );
          })
          .catch(() => {
            toast("Error updating assignment exercises", {
              icon: "🔥"
            });
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
    copyQuestion: build.mutation<
      DetailResponse<{ status: string; question_id: number; message: string }>,
      {
        original_question_id: number;
        new_name: string;
        assignment_id?: number;
        copy_to_assignment: boolean;
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
            toast("Error copying question", {
              icon: "🔥"
            });
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
  useCopyQuestionMutation
} = assignmentExerciseApi;
