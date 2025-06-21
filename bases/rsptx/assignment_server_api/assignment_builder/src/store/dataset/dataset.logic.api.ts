import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "@store/baseQuery";
import { datasetActions } from "@store/dataset/dataset.logic";
import toast from "react-hot-toast";

import { DetailResponse } from "@/types/api";
import { TableDropdownOption, SectionsResponse } from "@/types/dataset";

export const datasetApi = createApi({
  reducerPath: "datasetApi",
  keepUnusedDataFor: 60, //change to 0 for tests,
  baseQuery: baseQuery,
  endpoints: (build) => ({
    getWhichToGradeOptions: build.query<TableDropdownOption[], void>({
      query: () => ({
        method: "GET",
        url: "/assignment/instructor/which_to_grade_options"
      }),
      onQueryStarted: (_, { queryFulfilled, dispatch }) => {
        queryFulfilled.then((response) => {
          dispatch(datasetActions.setWhichToGradeOptions(response.data));
        });
        queryFulfilled.catch(() => {
          toast("Error getting which_to_grade options", {
            icon: "🔥"
          });
        });
      }
    }),
    getAutoGradeOptions: build.query<TableDropdownOption[], void>({
      query: () => ({
        method: "GET",
        url: "/assignment/instructor/autograde_options"
      }),
      onQueryStarted: (_, { queryFulfilled, dispatch }) => {
        queryFulfilled.then((response) => {
          dispatch(datasetActions.setAutoGradeOptions(response.data));
        });
        queryFulfilled.catch(() => {
          toast("Error getting autograde options", {
            icon: "🔥"
          });
        });
      }
    }),
    getLanguageOptions: build.query<TableDropdownOption[], void>({
      query: () => ({
        method: "GET",
        url: "/assignment/instructor/language_options"
      }),
      onQueryStarted: (_, { queryFulfilled, dispatch }) => {
        queryFulfilled.then((response) => {
          dispatch(datasetActions.setLanguageOptions(response.data));
        });
        queryFulfilled.catch(() => {
          toast("Error getting language options", {
            icon: "🔥"
          });
        });
      }
    }),
    getQuestionTypeOptions: build.query<TableDropdownOption[], void>({
      query: () => ({
        method: "GET",
        url: "/assignment/instructor/question_type_options"
      }),
      onQueryStarted: (_, { queryFulfilled, dispatch }) => {
        queryFulfilled.then((response) => {
          dispatch(datasetActions.setQuestionTypeOptions(response.data));
        });
        queryFulfilled.catch(() => {
          toast("Error getting question type options", {
            icon: "🔥"
          });
        });
      }
    }),
    getSectionsForChapter: build.query<{ label: string; value: string }[], string>({
      query: (chapterId) => ({
        method: "GET",
        url: `/assignment/instructor/sections_for_chapter/${chapterId}`
      }),
      transformResponse: (response: DetailResponse<SectionsResponse>) => {
        return response.detail.sections.map((section) => ({
          label: section.title,
          value: section.label
        }));
      },
      onQueryStarted: (_, { queryFulfilled, dispatch }) => {
        queryFulfilled.then((response) => {
          const originalSections = response.data.map((option) => ({
            title: option.label,
            label: option.value
          }));

          dispatch(datasetActions.setSections(originalSections));
        });
        queryFulfilled.catch(() => {
          toast("Error getting sections for chapter", {
            icon: "🔥"
          });
        });
      }
    })
  })
});

export const {
  useGetWhichToGradeOptionsQuery,
  useGetAutoGradeOptionsQuery,
  useGetLanguageOptionsQuery,
  useGetQuestionTypeOptionsQuery,
  useGetSectionsForChapterQuery
} = datasetApi;
