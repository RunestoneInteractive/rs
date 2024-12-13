import { createApi } from "@reduxjs/toolkit/query/react";
import { userActions } from "@store/user/userLogic";
import toast from "react-hot-toast";

import { baseQuery } from "@/store/baseQuery";
import { DetailResponse, HttpStatusCode } from "@/types/api";
import {
  Assignment,
  CreateAssignmentExercisePayload,
  CreateAssignmentPayload,
  CreateAssignmentValidationResponse,
  GetAssignmentsResponse
} from "@/types/assignment";
import { Exercise, GetExercisesResponse, UpdateAssignmentExercisePayload } from "@/types/exercises";

export const assignmentApi = createApi({
  reducerPath: "assignmentAPI",
  keepUnusedDataFor: 60, //change to 0 for tests,
  baseQuery: baseQuery,
  tagTypes: ["Assignments", "Exercises"],
  endpoints: (build) => ({
    getAssignments: build.query<Assignment[], void>({
      query: () => ({
        method: "GET",
        url: "/assignment/instructor/assignments"
      }),
      providesTags: ["Assignments"],
      transformResponse: (response: DetailResponse<GetAssignmentsResponse>) => {
        return response.detail.assignments;
      },
      onQueryStarted: (_, { dispatch, queryFulfilled }) => {
        queryFulfilled.catch((errorResponse) => {
          const { status } = errorResponse.error as {
            status: number;
          };

          if (status === HttpStatusCode.UNAUTHORIZED) {
            toast("Unauthorized to fetch assignments");
            dispatch(userActions.setIsAuthorized(false));
            return;
          }

          toast("Unable to fetch assignments", {
            icon: "🔥"
          });
        });
      }
    }),
    createAssignment: build.mutation<void, CreateAssignmentPayload>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/new_assignment",
        body
      }),
      invalidatesTags: (_, error) => {
        if (!error) {
          return [{ type: "Assignments" }];
        }
        return [];
      },
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled
          .then(() => {
            toast("Assignment created", { icon: "👍" });
          })
          .catch((errorResponse) => {
            const { status, data } = errorResponse.error as {
              status: number;
              data: DetailResponse<CreateAssignmentValidationResponse>;
            };

            if (status === HttpStatusCode.UNPROCESSABLE_CONTENT) {
              toast(`Error ${data.detail[0].msg} for input ${data.detail[0].loc.join()}`);
              return;
            }

            toast("Error creating assignment", {
              icon: "🔥"
            });
          });
      }
    }),
    updateAssignment: build.mutation<void, Assignment>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/update_assignment",
        body
      }),
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          toast("Error updating assignment", {
            icon: "🔥"
          });
        });
      }
    }),
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
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          toast("Unable to fetch exercises", {
            icon: "🔥"
          });
        });
      }
    }),
    updateAssignmentExercise: build.mutation<void, UpdateAssignmentExercisePayload>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/update_assignment_question",
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
          toast("Error updating assignment exercise", {
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
      },
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          toast("Error removing assignment exercise", {
            icon: "🔥"
          });
        });
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
    })
  })
});

export const {
  useGetAssignmentsQuery,
  useCreateAssignmentMutation,
  useGetExercisesQuery,
  useUpdateAssignmentExerciseMutation,
  useRemoveAssignmentExercisesMutation,
  useReorderAssignmentExercisesMutation
} = assignmentApi;
