import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "@store/baseQuery";
import { exercisesActions } from "@store/exercises/exercises.logic";
import { readingsActions } from "@store/readings/readings.logic";
import { notify } from "@components/ui/notify";

import { DetailResponse } from "@/types/api";
import { GetAvailableReadingsPayload } from "@/types/readings";
import { TreeNode } from "@/types/treeNode";

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
            notify.error("Couldn't search available readings. Try again.");
          });
      }
    })
  })
});

export const { useGetAvailableReadingsQuery } = readingsApi;
