import { configureStore } from "@reduxjs/toolkit";

import { baseQueryWithErrorHandlers } from "@/store/baseQuery";

import { courseApi } from "./course.logic.api";

vi.mock("@/store/baseQuery", () => ({
  baseQueryWithErrorHandlers: vi.fn()
}));

const buildStore = () =>
  configureStore({
    reducer: { [courseApi.reducerPath]: courseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(courseApi.middleware)
  });

describe("courseApi", () => {
  beforeEach(() => {
    vi.mocked(baseQueryWithErrorHandlers).mockReset();
  });

  it("loads recent instructor courses", async () => {
    vi.mocked(baseQueryWithErrorHandlers).mockResolvedValue({
      data: {
        detail: {
          courses: [
            {
              course_name: "cs101",
              last_access: "2026-10-07T12:00:00",
              is_current: true
            }
          ]
        }
      }
    });
    const store = buildStore();

    const result = await store
      .dispatch(courseApi.endpoints.getRecentInstructorCourses.initiate())
      .unwrap();

    expect(baseQueryWithErrorHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/assignment/instructor/courses/recent"
      }),
      expect.anything(),
      undefined
    );
    expect(result).toEqual([
      {
        course_name: "cs101",
        last_access: "2026-10-07T12:00:00",
        is_current: true
      }
    ]);
  });

  it("posts the selected course name", async () => {
    vi.mocked(baseQueryWithErrorHandlers).mockResolvedValue({
      data: { detail: { status: "success", course_name: "cs102" } }
    });
    const store = buildStore();

    await store.dispatch(courseApi.endpoints.switchInstructorCourse.initiate("cs102")).unwrap();

    expect(baseQueryWithErrorHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/assignment/instructor/courses/switch",
        body: { course_name: "cs102" }
      }),
      expect.anything(),
      undefined
    );
  });
});
