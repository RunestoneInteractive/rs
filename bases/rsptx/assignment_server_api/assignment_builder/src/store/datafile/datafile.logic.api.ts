import { createApi, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "@store/baseQuery";
import toast from "react-hot-toast";

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

const getErrorMessage = (error: FetchBaseQueryError): string => {
  if (error.status === 409) {
    const data = error.data as { detail?: string };
    return data?.detail || "A datafile with this filename already exists";
  }
  if (error.status === 403) {
    const data = error.data as { detail?: string };
    return data?.detail || "You are not the owner of this datafile";
  }
  if (error.status === 404) {
    const data = error.data as { detail?: string };
    return data?.detail || "Datafile not found";
  }
  if (error.data && typeof error.data === "object" && "detail" in error.data) {
    return (error.data as { detail: string }).detail;
  }
  return "Error processing datafile request";
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
          toast.error("Error fetching datafiles", { duration: 5000 });
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
          toast.error("Error fetching datafile", { duration: 5000 });
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
            toast.success("Datafile created successfully", { duration: 3000 });
          })
          .catch((error) => {
            const message = getErrorMessage(error.error as FetchBaseQueryError);
            toast.error(message, { duration: 5000 });
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
            toast.success("Datafile updated successfully", { duration: 3000 });
          })
          .catch((error) => {
            const message = getErrorMessage(error.error as FetchBaseQueryError);
            toast.error(message, { duration: 5000 });
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
            toast.success("Datafile deleted successfully", { duration: 3000 });
          })
          .catch((error) => {
            const message = getErrorMessage(error.error as FetchBaseQueryError);
            toast.error(message, { duration: 5000 });
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
