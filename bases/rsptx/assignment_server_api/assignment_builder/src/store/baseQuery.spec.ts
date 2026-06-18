import { notify } from "@components/ui/notify";

import { HttpStatusCode } from "@/types/api";

const mockInnerBaseQuery = vi.fn();

vi.mock("@components/ui/notify", () => ({
  notify: {
    error: vi.fn()
  }
}));

vi.mock("@reduxjs/toolkit/query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@reduxjs/toolkit/query")>();
  return {
    ...actual,
    fetchBaseQuery: vi.fn(() => mockInnerBaseQuery)
  };
});

describe("baseQueryWithErrorHandlers", () => {
  const mockApi = {} as Parameters<typeof import("@store/baseQuery").baseQueryWithErrorHandlers>[1];
  const mockExtraOptions = {};

  beforeEach(() => {
    mockInnerBaseQuery.mockReset();
    vi.mocked(notify.error).mockReset();
  });

  it("returns the result from baseQuery when there is no error", async () => {
    const expectedResult = { data: { id: 1 } };
    mockInnerBaseQuery.mockResolvedValue(expectedResult);

    const { baseQueryWithErrorHandlers } = await import("@store/baseQuery");
    const result = await baseQueryWithErrorHandlers("/some-endpoint", mockApi, mockExtraOptions);

    expect(result).toEqual(expectedResult);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("shows the session-expired toast when the response status is 401", async () => {
    const unauthorizedResult = {
      error: { status: HttpStatusCode.UNAUTHORIZED, data: "Unauthorized" }
    };
    mockInnerBaseQuery.mockResolvedValue(unauthorizedResult);

    const { baseQueryWithErrorHandlers } = await import("@store/baseQuery");
    await baseQueryWithErrorHandlers("/protected-endpoint", mockApi, mockExtraOptions);

    expect(notify.error).toHaveBeenCalledWith({
      id: "api-unauthorized",
      message: "Your session expired. Sign in again.",
      autoClose: 6000
    });
    expect(notify.error).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["500 server", HttpStatusCode.INTERNAL_SERVER_ERROR],
    ["400 bad request", HttpStatusCode.BAD_REQUEST],
    ["404 not found", HttpStatusCode.NOT_FOUND]
  ])("shows the generic failure toast for %s errors", async (_label, status) => {
    mockInnerBaseQuery.mockResolvedValue({ error: { status, data: "boom" } });

    const { baseQueryWithErrorHandlers } = await import("@store/baseQuery");
    await baseQueryWithErrorHandlers("/some-endpoint", mockApi, mockExtraOptions);

    expect(notify.error).toHaveBeenCalledWith({
      id: "api-request-failed",
      message: "Something went wrong. Try again.",
      autoClose: 6000
    });
  });

  it("uses a stable notification id so repeated failures do not stack", async () => {
    mockInnerBaseQuery.mockResolvedValue({
      error: { status: HttpStatusCode.INTERNAL_SERVER_ERROR, data: "boom" }
    });

    const { baseQueryWithErrorHandlers } = await import("@store/baseQuery");
    await baseQueryWithErrorHandlers("/a", mockApi, mockExtraOptions);
    await baseQueryWithErrorHandlers("/b", mockApi, mockExtraOptions);

    const ids = vi.mocked(notify.error).mock.calls.map(([data]) => (data as { id: string }).id);

    expect(ids).toEqual(["api-request-failed", "api-request-failed"]);
  });

  it("still returns the error result after showing a toast", async () => {
    const errorResult = {
      error: { status: HttpStatusCode.FORBIDDEN, data: "Forbidden" }
    };
    mockInnerBaseQuery.mockResolvedValue(errorResult);

    const { baseQueryWithErrorHandlers } = await import("@store/baseQuery");
    const result = await baseQueryWithErrorHandlers(
      "/forbidden-endpoint",
      mockApi,
      mockExtraOptions
    );

    expect(result).toEqual(errorResult);
  });

  it("passes the args, api, and extraOptions through to the inner baseQuery", async () => {
    const successResult = { data: "ok" };
    mockInnerBaseQuery.mockResolvedValue(successResult);

    const args = { url: "/test", method: "POST", body: { foo: "bar" } };
    const { baseQueryWithErrorHandlers } = await import("@store/baseQuery");
    await baseQueryWithErrorHandlers(args, mockApi, mockExtraOptions);

    expect(mockInnerBaseQuery).toHaveBeenCalledWith(args, mockApi, mockExtraOptions);
  });
});
