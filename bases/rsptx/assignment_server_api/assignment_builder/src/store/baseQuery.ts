import {
  BaseQueryFn,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError
} from "@reduxjs/toolkit/query";
import toast from "react-hot-toast";

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
  let result = await baseQuery(args, api, extraOptions);

  if (result.error) {
    if (result.error.status === HttpStatusCode.UNAUTHORIZED) {
      toast("Unauthorized");
    } else {
      toast("Something went wrong");
    }
  }

  return result;
};
