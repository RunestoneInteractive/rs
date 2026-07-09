import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "@store/baseQuery";
import { datasetActions } from "@store/dataset/dataset.logic";
import { notify } from "@components/ui/notify";

import { DetailResponse } from "@/types/api";
import { TableDropdownOption, SectionsResponse } from "@/types/dataset";

export const DATASET_TOAST_COPY = {
  whichToGradeError: "Couldn't load grading options. Refresh the page.",
  autogradeError: "Couldn't load autograde options. Refresh the page.",
  languageError: "Couldn't load language options. Refresh the page.",
  questionTypeError: "Couldn't load question type options. Refresh the page.",
  sectionsError: "Couldn't load sections for the chapter. Refresh the page."
} as const;

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
          notify.error(DATASET_TOAST_COPY.whichToGradeError);
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
          notify.error(DATASET_TOAST_COPY.autogradeError);
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
          notify.error(DATASET_TOAST_COPY.languageError);
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
          notify.error(DATASET_TOAST_COPY.questionTypeError);
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
          notify.error(DATASET_TOAST_COPY.sectionsError);
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
