import { notify } from "@components/ui/notify";
import { createApi } from "@reduxjs/toolkit/query/react";
import { assignmentActions } from "@store/assignment/assignment.logic";
import { userActions } from "@store/user/userLogic";

import { baseQuery } from "@/store/baseQuery";
import { DetailResponse, HttpStatusCode } from "@/types/api";
import {
  Assignment,
  CreateAssignmentPayload,
  CreateAssignmentValidationResponse,
  GetAssignmentResponse,
  GetAssignmentsResponse
} from "@/types/assignment";
import {
  ImportAssignmentResult,
  ImportCourseResult,
  ShareableTreeRequest,
  ShareableTreeResponse,
  SharedAssignmentPreview
} from "@/types/assignmentSharing";

export const ASSIGNMENT_TOAST_COPY = {
  loadAssignmentsError: "Couldn't load assignments. Refresh the page.",
  loadAssignmentError: "Couldn't load the assignment. Refresh the page.",
  created: "Assignment created",
  createValidationError: (message: string) => `Couldn't create assignment: ${message}`,
  createError: "Couldn't create assignment. Try again.",
  updateError: "Couldn't update assignment. Try again.",
  deleted: "Assignment deleted",
  deleteError: "Couldn't delete assignment. Try again.",
  duplicated: (name: string) => `Assignment duplicated as "${name}"`,
  duplicateError: "Couldn't duplicate assignment. Try again.",
  previewSharedError: "Couldn't load that assignment. It may no longer be shared.",
  imported: (name: string, skippedReadings: number) =>
    skippedReadings > 0
      ? `Imported as "${name}", without ${skippedReadings} reading${
          skippedReadings === 1 ? "" : "s"
        } that belong to the other book. It is hidden until you make it visible.`
      : `Imported as "${name}". It is hidden until you make it visible.`,
  importError: "Couldn't import assignment. It may no longer be shared.",
  // Shown separately from the success toast so it doesn't get lost inside a
  // longer message -- the instructor needs to notice and go fix the timezone.
  duedateWarning: (duedateWarning: string) => duedateWarning,
  loadTreeError: "Couldn't load shared assignments. Try again.",
  // Partial success is a normal outcome for a multi-import, so the toast counts
  // rather than claiming everything worked.
  importedMany: (result: {
    imported: string[];
    skipped_existing: string[];
    skipped_readings: number;
    failed: string[];
    duedate_not_shifted: number;
  }) => {
    const parts = [`Imported ${result.imported.length}`];

    if (result.skipped_existing.length) {
      parts.push(`${result.skipped_existing.length} already in your course`);
    }
    if (result.failed.length) {
      parts.push(`${result.failed.length} couldn't be imported`);
    }
    if (result.skipped_readings) {
      parts.push(`${result.skipped_readings} readings left behind`);
    }
    if (result.duedate_not_shifted) {
      parts.push(`${result.duedate_not_shifted} due dates not adjusted`);
    }
    return `${parts.join(", ")}. Imports are hidden until you make them visible.`;
  }
} as const;

export const assignmentApi = createApi({
  reducerPath: "assignmentAPI",
  keepUnusedDataFor: 60, //change to 0 for tests,
  baseQuery: baseQuery,
  tagTypes: ["Assignments", "Exercises", "Assignment", "ShareableTree"],
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
            notify.error({
              id: "api-unauthorized",
              message: "Your session expired. Sign in again.",
              autoClose: 6000
            });
            dispatch(userActions.setIsAuthorized(false));
            return;
          }

          notify.error(ASSIGNMENT_TOAST_COPY.loadAssignmentsError);
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
            notify.error({
              id: "api-unauthorized",
              message: "Your session expired. Sign in again.",
              autoClose: 6000
            });
            dispatch(userActions.setIsAuthorized(false));
            return;
          }

          notify.error(ASSIGNMENT_TOAST_COPY.loadAssignmentError);
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
            notify.success(ASSIGNMENT_TOAST_COPY.created);
          })
          .catch((errorResponse) => {
            const { status, data } = errorResponse.error as {
              status: number;
              data: DetailResponse<CreateAssignmentValidationResponse>;
            };

            if (status === HttpStatusCode.UNPROCESSABLE_CONTENT) {
              notify.error(ASSIGNMENT_TOAST_COPY.createValidationError(data.detail[0].msg));
              return;
            }

            notify.error(ASSIGNMENT_TOAST_COPY.createError);
          });
      }
    }),
    updateAssignment: build.mutation<void, Assignment>({
      query: (body) => ({
        method: "PUT",
        url: `/assignment/instructor/assignments/${body.id}`,
        body
      }),
      invalidatesTags: (_, error) => {
        if (!error) {
          return [{ type: "Assignments" }, { type: "Assignment" }];
        }
        return [];
      },
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          notify.error(ASSIGNMENT_TOAST_COPY.updateError);
        });
      }
    }),
    removeAssignment: build.mutation<void, Assignment>({
      query: (body) => ({
        method: "DELETE",
        url: `/assignment/instructor/assignments/${body.id}`
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
            notify.success(ASSIGNMENT_TOAST_COPY.deleted);
          })
          .catch(() => {
            notify.error(ASSIGNMENT_TOAST_COPY.deleteError);
          });
      }
    }),
    duplicateAssignment: build.mutation<DetailResponse<{ id: number; name: string }>, number>({
      query: (assignmentId) => ({
        method: "POST",
        url: `/assignment/instructor/assignments/${assignmentId}/duplicate`
      }),
      invalidatesTags: (_, error) => {
        if (!error) {
          return [{ type: "Assignments" }];
        }
        return [];
      },
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled
          .then(({ data }) => {
            notify.success(ASSIGNMENT_TOAST_COPY.duplicated(data.detail.name));
          })
          .catch(() => {
            notify.error(ASSIGNMENT_TOAST_COPY.duplicateError);
          });
      }
    }),
    previewSharedAssignment: build.query<SharedAssignmentPreview, number>({
      query: (assignmentId) => ({
        method: "GET",
        url: `/assignment/instructor/assignments/${assignmentId}/preview`
      }),
      keepUnusedDataFor: 0.1,
      transformResponse: (response: DetailResponse<SharedAssignmentPreview>) => response.detail,
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          notify.error(ASSIGNMENT_TOAST_COPY.previewSharedError);
        });
      }
    }),
    shareableTree: build.query<ShareableTreeResponse, ShareableTreeRequest>({
      query: ({ search, use_base_course, only_my_courses, page, limit }) => ({
        method: "GET",
        url: "/assignment/instructor/shareable_tree",
        params: { search, use_base_course, only_my_courses, page, limit }
      }),
      providesTags: ["ShareableTree"],
      transformResponse: (response: DetailResponse<ShareableTreeResponse>) => response.detail,
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          notify.error(ASSIGNMENT_TOAST_COPY.loadTreeError);
        });
      }
    }),
    importCourseAssignments: build.mutation<DetailResponse<ImportCourseResult>, number>({
      query: (sourceCourseId) => ({
        method: "POST",
        url: "/assignment/instructor/assignments/import_course",
        body: { source_course_id: sourceCourseId }
      }),
      invalidatesTags: (_, error) =>
        error ? [] : [{ type: "Assignments" as const }, { type: "ShareableTree" as const }],
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled
          .then(({ data }) => {
            notify.success(ASSIGNMENT_TOAST_COPY.importedMany(data.detail));
            if (data.detail.duedate_not_shifted) {
              notify.info(
                ASSIGNMENT_TOAST_COPY.duedateWarning(
                  "Some due dates could not be adjusted because a course timezone " +
                    "setting is invalid. Update it in Course Settings, then check " +
                    "the affected assignments."
                )
              );
            }
          })
          .catch(() => {
            notify.error(ASSIGNMENT_TOAST_COPY.importError);
          });
      }
    }),
    importAssignment: build.mutation<DetailResponse<ImportAssignmentResult>, number>({
      query: (assignmentId) => ({
        method: "POST",
        url: `/assignment/instructor/assignments/${assignmentId}/import`
      }),
      invalidatesTags: (_, error) =>
        error ? [] : [{ type: "Assignments" as const }, { type: "ShareableTree" as const }],
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled
          .then(({ data }) => {
            notify.success(
              ASSIGNMENT_TOAST_COPY.imported(data.detail.name, data.detail.skipped_readings)
            );
            if (data.detail.duedate_warning) {
              notify.info(ASSIGNMENT_TOAST_COPY.duedateWarning(data.detail.duedate_warning));
            }
          })
          .catch(() => {
            notify.error(ASSIGNMENT_TOAST_COPY.importError);
          });
      }
    })
  })
});

export const {
  useGetAssignmentsQuery,
  useGetAssignmentQuery,
  useUpdateAssignmentMutation,
  useCreateAssignmentMutation,
  useRemoveAssignmentMutation,
  useDuplicateAssignmentMutation,
  useShareableTreeQuery,
  usePreviewSharedAssignmentQuery,
  useImportAssignmentMutation,
  useImportCourseAssignmentsMutation
} = assignmentApi;
