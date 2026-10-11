import { createApi } from "@reduxjs/toolkit/query/react";

import { baseQueryWithErrorHandlers } from "@/store/baseQuery";
import { DetailResponse } from "@/types/api";

export interface InstructorCourse {
  course_name: string;
  last_access: string | null;
  is_current: boolean;
}

export interface RecentInstructorCoursesResponse {
  courses: InstructorCourse[];
}

export interface SwitchCourseResponse {
  status: "success";
  course_name: string;
}

export const courseApi = createApi({
  reducerPath: "courseApi",
  baseQuery: baseQueryWithErrorHandlers,
  endpoints: (build) => ({
    getRecentInstructorCourses: build.query<InstructorCourse[], void>({
      query: () => ({
        method: "GET",
        url: "/assignment/instructor/courses/recent"
      }),
      transformResponse: (response: DetailResponse<RecentInstructorCoursesResponse>) =>
        response.detail.courses
    }),
    switchInstructorCourse: build.mutation<SwitchCourseResponse, string>({
      query: (courseName) => ({
        method: "POST",
        url: "/assignment/instructor/courses/switch",
        body: { course_name: courseName }
      }),
      transformResponse: (response: DetailResponse<SwitchCourseResponse>) => response.detail
    })
  })
});

export const { useGetRecentInstructorCoursesQuery, useSwitchInstructorCourseMutation } = courseApi;
