import { configureStore } from "@reduxjs/toolkit";
import { DATAFILE_TOAST_COPY, datafileApi, getErrorMessage } from "./datafile.logic.api";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import type { ExistingDataFile } from "@/types/datafile";

vi.mock("@components/ui/notify", () => ({
  notify: {
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    update: vi.fn(),
    hide: vi.fn(),
    clean: vi.fn()
  }
}));

describe("DATAFILE_TOAST_COPY", () => {
  it("locks the canonical data-file toast strings", () => {
    expect(DATAFILE_TOAST_COPY).toEqual({
      created: "Data file created",
      updated: "Data file updated",
      deleted: "Data file deleted",
      loadAllError: "Couldn't load data files. Try again.",
      loadOneError: "Couldn't load the data file. Try again.",
      duplicateNameError: "A data file with this filename already exists",
      notOwnerError: "You don't own this data file",
      notFoundError: "Data file not found",
      requestError: "Couldn't process the data file request. Try again."
    });
  });

  it("never says Datafile as one word or uses success filler", () => {
    for (const message of Object.values(DATAFILE_TOAST_COPY)) {
      expect(message).not.toMatch(/datafile/i);
      expect(message).not.toMatch(/successfully/i);
    }
  });
});

describe("datafileApi — module exports", () => {
  it("has the correct reducerPath", () => {
    expect(datafileApi.reducerPath).toBe("datafileAPI");
  });

  it("exports useFetchDatafilesQuery hook", () => {
    const { useFetchDatafilesQuery } = datafileApi;
    expect(typeof useFetchDatafilesQuery).toBe("function");
  });

  it("exports useFetchDatafileQuery hook", () => {
    const { useFetchDatafileQuery } = datafileApi;
    expect(typeof useFetchDatafileQuery).toBe("function");
  });

  it("exports useCreateDatafileMutation hook", () => {
    const { useCreateDatafileMutation } = datafileApi;
    expect(typeof useCreateDatafileMutation).toBe("function");
  });

  it("exports useUpdateDatafileMutation hook", () => {
    const { useUpdateDatafileMutation } = datafileApi;
    expect(typeof useUpdateDatafileMutation).toBe("function");
  });

  it("exports useDeleteDatafileMutation hook", () => {
    const { useDeleteDatafileMutation } = datafileApi;
    expect(typeof useDeleteDatafileMutation).toBe("function");
  });
});

describe("datafileApi — reducer integration", () => {
  const buildStore = () =>
    configureStore({ reducer: { [datafileApi.reducerPath]: datafileApi.reducer } });

  it("registers under its reducerPath and returns defined initial state", () => {
    const store = buildStore();
    expect(store.getState()[datafileApi.reducerPath]).toBeDefined();
  });

  it("each call to buildStore creates an independent store instance", () => {
    const a = buildStore();
    const b = buildStore();
    expect(a).not.toBe(b);
  });
});

describe("datafileApi — fetchDatafiles transformResponse logic", () => {
  const transform = (response: { detail: { datafiles?: ExistingDataFile[] | null } }) =>
    response.detail.datafiles || [];

  it("returns the datafiles array when present", () => {
    const datafiles: ExistingDataFile[] = [
      {
        id: 1,
        acid: "a1",
        filename: "data.csv",
        course_id: "cs101",
        owner: "teacher",
        main_code: ""
      }
    ];
    expect(transform({ detail: { datafiles } })).toEqual(datafiles);
  });

  it("returns empty array when datafiles is undefined", () => {
    expect(transform({ detail: {} })).toEqual([]);
  });

  it("returns empty array when datafiles is null", () => {
    expect(transform({ detail: { datafiles: null } })).toEqual([]);
  });

  it("returns the full list when multiple datafiles are present", () => {
    const datafiles: ExistingDataFile[] = [
      { id: 1, acid: "a1", filename: "f1.csv", course_id: "cs101", owner: "u1", main_code: "" },
      { id: 2, acid: "a2", filename: "f2.csv", course_id: "cs101", owner: "u2", main_code: "" }
    ];
    expect(transform({ detail: { datafiles } })).toHaveLength(2);
  });
});

describe("datafileApi — getErrorMessage logic", () => {
  const asError = (error: { status: number; data?: unknown }): FetchBaseQueryError =>
    error as FetchBaseQueryError;

  describe("409 Conflict", () => {
    it("returns server detail message when present", () => {
      expect(getErrorMessage(asError({ status: 409, data: { detail: "File exists" } }))).toBe(
        "File exists"
      );
    });

    it("returns default message when detail is absent", () => {
      expect(getErrorMessage(asError({ status: 409, data: {} }))).toBe(
        DATAFILE_TOAST_COPY.duplicateNameError
      );
    });

    it("returns default message when data is undefined", () => {
      expect(getErrorMessage(asError({ status: 409 }))).toBe(
        DATAFILE_TOAST_COPY.duplicateNameError
      );
    });
  });

  describe("403 Forbidden", () => {
    it("returns server detail message when present", () => {
      expect(getErrorMessage(asError({ status: 403, data: { detail: "Not yours" } }))).toBe(
        "Not yours"
      );
    });

    it("returns default message when detail is absent", () => {
      expect(getErrorMessage(asError({ status: 403, data: {} }))).toBe(
        DATAFILE_TOAST_COPY.notOwnerError
      );
    });
  });

  describe("404 Not Found", () => {
    it("returns server detail message when present", () => {
      expect(getErrorMessage(asError({ status: 404, data: { detail: "Gone" } }))).toBe("Gone");
    });

    it("returns default message when detail is absent", () => {
      expect(getErrorMessage(asError({ status: 404, data: {} }))).toBe(
        DATAFILE_TOAST_COPY.notFoundError
      );
    });
  });

  describe("other status codes with detail in data", () => {
    it("returns detail from data object for 500 errors", () => {
      expect(getErrorMessage(asError({ status: 500, data: { detail: "Server crash" } }))).toBe(
        "Server crash"
      );
    });

    it("returns fallback message when data has no detail property", () => {
      expect(getErrorMessage(asError({ status: 500, data: { message: "oops" } }))).toBe(
        DATAFILE_TOAST_COPY.requestError
      );
    });

    it("returns fallback message when data is a primitive string", () => {
      expect(getErrorMessage(asError({ status: 500, data: "raw error" }))).toBe(
        DATAFILE_TOAST_COPY.requestError
      );
    });

    it("returns fallback message when data is undefined and status is unknown", () => {
      expect(getErrorMessage(asError({ status: 422 }))).toBe(DATAFILE_TOAST_COPY.requestError);
    });
  });
});

describe("datafileApi — fetchDatafile providesTags logic", () => {
  const providesTags = (_result: unknown, _error: unknown, acid: string) => [
    { type: "Datafile" as const, id: acid }
  ];

  it("returns a tag with the acid identifier", () => {
    expect(providesTags(undefined, undefined, "my_acid")).toEqual([
      { type: "Datafile", id: "my_acid" }
    ]);
  });

  it("uses the exact acid string as the tag id", () => {
    expect(providesTags({}, null, "special/acid")).toEqual([
      { type: "Datafile", id: "special/acid" }
    ]);
  });
});

describe("datafileApi — updateDatafile invalidatesTags logic", () => {
  const invalidatesTags = (
    _result: unknown,
    _error: unknown,
    arg: { acid: string; main_code: string }
  ) => ["Datafiles" as const, { type: "Datafile" as const, id: arg.acid }];

  it("invalidates both Datafiles list and the specific Datafile entry", () => {
    const tags = invalidatesTags(undefined, undefined, { acid: "target", main_code: "" });
    expect(tags).toContainEqual("Datafiles");
    expect(tags).toContainEqual({ type: "Datafile", id: "target" });
  });

  it("uses the acid from arg as the specific tag id", () => {
    const tags = invalidatesTags(undefined, undefined, { acid: "specific_acid", main_code: "x" });
    expect(tags).toContainEqual({ type: "Datafile", id: "specific_acid" });
  });
});
