import { createApi } from "@reduxjs/toolkit/query/react";
import { assignmentExerciseApi } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { baseQuery } from "@store/baseQuery";
import toast from "react-hot-toast";

import { DetailResponse } from "@/types/api";
import {
  CreateExercisesPayload,
  ExercisesSearchRequest,
  ExercisesSearchResponse
} from "@/types/exercises";

import { assignmentApi } from "../assignment/assignment.logic.api";

export const exercisesApi = createApi({
  reducerPath: "exercisesAPI",
  keepUnusedDataFor: 60, //change to 0 for tests,
  baseQuery: baseQuery,
  tagTypes: ["Exercises"],
  endpoints: (build) => ({
    createNewExercise: build.mutation<number, CreateExercisesPayload>({
      query: (body) => ({
        method: "POST",
        url: "/assignment/instructor/question",
        body
      }),
      onQueryStarted: (_, { queryFulfilled, dispatch }) => {
        queryFulfilled
          .then(() => {
            dispatch(assignmentExerciseApi.util.invalidateTags(["Exercises"]));
            dispatch(assignmentApi.util.invalidateTags(["Assignment", "Assignments"]));
          })
          .catch(() => {
            toast("Error creating new exercise", {
              icon: "🔥"
            });
          });
      }
    }),
    searchExercisesSmart: build.query<ExercisesSearchResponse, ExercisesSearchRequest>({
      query: (params) => ({
        method: "POST",
        url: "/assignment/instructor/exercises/search",
        body: params
      }),
      transformResponse: (response: DetailResponse<ExercisesSearchResponse>) => {
        return {
          exercises: response.detail.exercises || [],
          pagination: response.detail.pagination || {
            total: 0,
            page: 0,
            limit: 20,
            pages: 0
          }
        };
      },
      onQueryStarted: (_, { queryFulfilled }) => {
        queryFulfilled.catch(() => {
          toast("Error searching exercises", {
            icon: "🔥"
          });
        });
      }
    })
  })
});

export const { useCreateNewExerciseMutation, useSearchExercisesSmartQuery } = exercisesApi;
