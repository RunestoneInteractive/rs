import { createApi } from "@reduxjs/toolkit/query/react";
import { assignmentActions } from "@store/assignment/assignment.logic";
import { userActions } from "@store/user/userLogic";
import toast from "react-hot-toast";

import { baseQuery } from "@/store/baseQuery";
import { DetailResponse, HttpStatusCode } from "@/types/api";
import {
  Assignment,
  CreateAssignmentPayload,
  CreateAssignmentValidationResponse,
  GetAssignmentResponse,
  GetAssignmentsResponse
} from "@/types/assignment";

export const assignmentApi = createApi({
  reducerPath: "assignmentAPI",
  keepUnusedDataFor: 60, //change to 0 for tests,
  baseQuery: baseQuery,
  tagTypes: ["Assignments", "Exercises", "Assignment"],
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
    getAssignment: build.query<Assignment, number>({
      query: (id: number) => ({
        method: "GET",
        url: `/assignment/instructor/assignments/${id}`
      }),
      keepUnusedDataFor: 0.1,
      providesTags: ["Assignment"],
      transformResponse: (response: DetailResponse<GetAssignmentResponse>) => {
        return response.detail.assignment;
      },
      onQueryStarted: (_, { dispatch, queryFulfilled }) => {
        queryFulfilled.catch((errorResponse) => {
          const { status } = errorResponse.error as {
            status: number;
          };

          if (status === HttpStatusCode.UNAUTHORIZED) {
            toast("Unauthorized to fetch assignment");
            dispatch(userActions.setIsAuthorized(false));
            return;
          }

          toast("Unable to fetch assignment", {
            icon: "🔥"
          });
        });
      }
    }),
    createAssignment: build.mutation<DetailResponse<{ id: number }>, CreateAssignmentPayload>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/assignments",
        body
      }),
      invalidatesTags: (_, error) => {
        if (!error) {
          return [{ type: "Assignments" }];
        }
        return [];
      },
      onQueryStarted: (_, { queryFulfilled, dispatch }) => {
        queryFulfilled
          .then(({ data }) => {
            dispatch(assignmentActions.setSelectedAssignmentId(data.detail.id));
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
        method: "PUT",
        url: `/assignment/instructor/assignments/${body.id}`,
        body
      }),
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          toast("Error updating assignment", {
            icon: "🔥"
          });
        });
      }
    })
  })
});

export const {
  useGetAssignmentsQuery,
  useGetAssignmentQuery,
  useUpdateAssignmentMutation,
  useCreateAssignmentMutation
} = assignmentApi;
