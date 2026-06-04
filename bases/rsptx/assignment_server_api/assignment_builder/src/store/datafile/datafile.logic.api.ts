import { createApi, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "@store/baseQuery";
import { notify } from "@components/ui/notify";

import { DetailResponse } from "@/types/api";
import {
  CreateDataFilePayload,
  CreateDataFileResponse,
  DeleteDataFileResponse,
  ExistingDataFile,
  FetchDataFilesResponse,
  GetDataFileResponse,
  UpdateDataFilePayload,
  UpdateDataFileResponse
} from "@/types/datafile";

export const DATAFILE_TOAST_COPY = {
  created: "Data file created",
  updated: "Data file updated",
  deleted: "Data file deleted",
  loadAllError: "Couldn't load data files. Try again.",
  loadOneError: "Couldn't load the data file. Try again.",
  duplicateNameError: "A data file with this filename already exists",
  notOwnerError: "You don't own this data file",
  notFoundError: "Data file not found",
  requestError: "Couldn't process the data file request. Try again."
} as const;

export const getErrorMessage = (error: FetchBaseQueryError): string => {
  if (error.status === 409) {
    const data = error.data as { detail?: string };
    return data?.detail || DATAFILE_TOAST_COPY.duplicateNameError;
  }
  if (error.status === 403) {
    const data = error.data as { detail?: string };
    return data?.detail || DATAFILE_TOAST_COPY.notOwnerError;
  }
  if (error.status === 404) {
    const data = error.data as { detail?: string };
    return data?.detail || DATAFILE_TOAST_COPY.notFoundError;
  }
  if (error.data && typeof error.data === "object" && "detail" in error.data) {
    return (error.data as { detail: string }).detail;
  }
  return DATAFILE_TOAST_COPY.requestError;
};

export const datafileApi = createApi({
  reducerPath: "datafileAPI",
  keepUnusedDataFor: 60,
  baseQuery: baseQuery,
  tagTypes: ["Datafiles", "Datafile"],
  endpoints: (build) => ({
    fetchDatafiles: build.query<ExistingDataFile[], void>({
      query: () => ({
        method: "GET",
        url: `/assignment/instructor/datafiles`
      }),
      transformResponse: (response: DetailResponse<FetchDataFilesResponse>) => {
        return response.detail.datafiles || [];
      },
      providesTags: ["Datafiles"],
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          notify.error(DATAFILE_TOAST_COPY.loadAllError);
        });
      }
    }),
    fetchDatafile: build.query<GetDataFileResponse, string>({
      query: (acid) => ({
        method: "GET",
        url: `/assignment/instructor/datafile/${encodeURIComponent(acid)}`
      }),
      transformResponse: (response: DetailResponse<GetDataFileResponse>) => {
        return response.detail;
      },
      providesTags: (result, error, acid) => [{ type: "Datafile", id: acid }],
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          notify.error(DATAFILE_TOAST_COPY.loadOneError);
        });
      }
    }),
    createDatafile: build.mutation<CreateDataFileResponse, CreateDataFilePayload>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/datafile",
        body
      }),
      transformResponse: (response: DetailResponse<CreateDataFileResponse>) => {
        return response.detail;
      },
      invalidatesTags: ["Datafiles"],
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled
          .then(() => {
            notify.success(DATAFILE_TOAST_COPY.created);
          })
          .catch((error) => {
            const message = getErrorMessage(error.error as FetchBaseQueryError);
            notify.error(message);
          });
      }
    }),
    updateDatafile: build.mutation<UpdateDataFileResponse, UpdateDataFilePayload>({
      query: (body) => ({
        method: "PUT",
        url: "/assignment/instructor/datafile",
        body
      }),
      transformResponse: (response: DetailResponse<UpdateDataFileResponse>) => {
        return response.detail;
      },
      invalidatesTags: (result, error, arg) => ["Datafiles", { type: "Datafile", id: arg.acid }],
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled
          .then(() => {
            notify.success(DATAFILE_TOAST_COPY.updated);
          })
          .catch((error) => {
            const message = getErrorMessage(error.error as FetchBaseQueryError);
            notify.error(message);
          });
      }
    }),
    deleteDatafile: build.mutation<DeleteDataFileResponse, string>({
      query: (acid) => ({
        method: "DELETE",
        url: `/assignment/instructor/datafile/${encodeURIComponent(acid)}`
      }),
      transformResponse: (response: DetailResponse<DeleteDataFileResponse>) => {
        return response.detail;
      },
      invalidatesTags: ["Datafiles"],
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled
          .then(() => {
            notify.success(DATAFILE_TOAST_COPY.deleted);
          })
          .catch((error) => {
            const message = getErrorMessage(error.error as FetchBaseQueryError);
            notify.error(message);
          });
      }
    })
  })
});

export const {
  useFetchDatafilesQuery,
  useFetchDatafileQuery,
  useCreateDatafileMutation,
  useUpdateDatafileMutation,
  useDeleteDatafileMutation
} = datafileApi;
