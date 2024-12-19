import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "@store/baseQuery";
import { exercisesActions } from "@store/exercises/exercises.logic";
import { readingsActions } from "@store/readings/readings.logic";
import { TreeNode } from "primereact/treenode";
import toast from "react-hot-toast";

import { DetailResponse } from "@/types/api";
import { GetAvailableReadingsPayload } from "@/types/readings";

export const readingsApi = createApi({
  reducerPath: "readingsAPI",
  keepUnusedDataFor: 60, //change to 0 for tests,
  baseQuery: baseQuery,
  tagTypes: ["Readings"],
  endpoints: (build) => ({
    getAvailableReadings: build.query<TreeNode[], GetAvailableReadingsPayload>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/fetch_chooser_data",
        body
      }),
      providesTags: ["Readings"],
      transformResponse: (response: DetailResponse<{ questions: TreeNode[] }>) => {
        return response.detail.questions;
      },
      onQueryStarted: (_, { queryFulfilled, dispatch }) => {
        queryFulfilled
          .then(({ data }) => {
            dispatch(readingsActions.setAvailableReadings(data));
            dispatch(exercisesActions.setAvailableExercises(data));
          })
          .catch(() => {
            toast("Error searching available readings", {
              icon: "🔥"
            });
          });
      }
    })
  })
});

export const { useGetAvailableReadingsQuery } = readingsApi;
