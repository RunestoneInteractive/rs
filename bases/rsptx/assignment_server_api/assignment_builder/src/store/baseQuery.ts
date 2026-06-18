import {
  BaseQueryFn,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError
} from "@reduxjs/toolkit/query";
import { notify } from "@components/ui/notify";

import { HttpStatusCode } from "@/types/api";

export const baseQuery = fetchBaseQuery({
  baseUrl: location.origin,
  prepareHeaders: (headers) => {
    headers.set("Accept", "application/json");

    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return headers;
  }
});

export const baseQueryWithErrorHandlers: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);

  if (result.error) {
    if (result.error.status === HttpStatusCode.UNAUTHORIZED) {
      notify.error({
        id: "api-unauthorized",
        message: "Your session expired. Sign in again.",
        autoClose: 6000
      });
    } else {
      notify.error({
        id: "api-request-failed",
        message: "Something went wrong. Try again.",
        autoClose: 6000
      });
    }
  }

  return result;
};
