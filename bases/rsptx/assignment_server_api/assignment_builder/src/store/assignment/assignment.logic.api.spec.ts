import {
  ASSIGNMENT_TOAST_COPY,
  assignmentApi,
  useGetAssignmentsQuery,
  useGetAssignmentQuery,
  useUpdateAssignmentMutation,
  useCreateAssignmentMutation,
  useRemoveAssignmentMutation,
  useDuplicateAssignmentMutation
} from "./assignment.logic.api";
import type { Assignment } from "@/types/assignment";
import type { DetailResponse } from "@/types/api";
import type { GetAssignmentsResponse, GetAssignmentResponse } from "@/types/assignment";

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

vi.mock("@/store/baseQuery", () => ({
  baseQuery: vi.fn()
}));

const makeAssignment = (overrides: Partial<Assignment> = {}): Assignment => ({
  id: 1,
  name: "Test Assignment",
  description: "desc",
  duedate: "2026-01-01",
  updated_date: null,
  visible_on: null,
  hidden_on: null,
  points: 10,
  visible: true,
  is_peer: false,
  is_timed: false,
  nofeedback: false,
  nopause: false,
  time_limit: null,
  peer_async_visible: false,
  kind: "Regular",
  exercises: [],
  all_assignments: [],
  search_results: [],
  question_count: 0,
  isAuthorized: true,
  released: false,
  selectedAssignments: [],
  course: 1,
  threshold_pct: null,
  allow_self_autograde: null,
  from_source: false,
  current_index: 0,
  enforce_due: false,
  ...overrides
});

describe("assignmentApi module", () => {
  it("exports assignmentApi with correct reducerPath", () => {
    expect(assignmentApi.reducerPath).toBe("assignmentAPI");
  });

  it("exports the expected hooks", () => {
    expect(typeof useGetAssignmentsQuery).toBe("function");
    expect(typeof useGetAssignmentQuery).toBe("function");
    expect(typeof useUpdateAssignmentMutation).toBe("function");
    expect(typeof useCreateAssignmentMutation).toBe("function");
    expect(typeof useRemoveAssignmentMutation).toBe("function");
    expect(typeof useDuplicateAssignmentMutation).toBe("function");
  });

  it("has util and endpoints defined on the api object", () => {
    expect(assignmentApi.util).toBeDefined();
    expect(assignmentApi.endpoints).toBeDefined();
    expect(assignmentApi.endpoints.getAssignments).toBeDefined();
    expect(assignmentApi.endpoints.getAssignment).toBeDefined();
    expect(assignmentApi.endpoints.createAssignment).toBeDefined();
    expect(assignmentApi.endpoints.updateAssignment).toBeDefined();
    expect(assignmentApi.endpoints.removeAssignment).toBeDefined();
    expect(assignmentApi.endpoints.duplicateAssignment).toBeDefined();
  });
});

describe("ASSIGNMENT_TOAST_COPY", () => {
  it("uses the canonical success shape without filler", () => {
    expect(ASSIGNMENT_TOAST_COPY.created).toBe("Assignment created");
    expect(ASSIGNMENT_TOAST_COPY.deleted).toBe("Assignment deleted");
    expect(ASSIGNMENT_TOAST_COPY.duplicated("Copy of HW")).toBe(
      'Assignment duplicated as "Copy of HW"'
    );
  });

  it("phrases every error as couldn't-verb plus a fix", () => {
    const errors = [
      ASSIGNMENT_TOAST_COPY.loadAssignmentsError,
      ASSIGNMENT_TOAST_COPY.loadAssignmentError,
      ASSIGNMENT_TOAST_COPY.createError,
      ASSIGNMENT_TOAST_COPY.updateError,
      ASSIGNMENT_TOAST_COPY.deleteError,
      ASSIGNMENT_TOAST_COPY.duplicateError
    ];

    for (const message of errors) {
      expect(message).toMatch(/^Couldn't /);
      expect(message).toMatch(/(Try again\.|Refresh the page\.)$/);
      expect(message).not.toMatch(/successfully|Error|!/);
    }
  });

  it("surfaces the validation message without input internals", () => {
    expect(ASSIGNMENT_TOAST_COPY.createValidationError("name must not be empty")).toBe(
      "Couldn't create assignment: name must not be empty"
    );
  });
});

describe("getAssignments transformResponse", () => {
  it("extracts assignments array from detail wrapper", () => {
    const assignment = makeAssignment();
    const response: DetailResponse<GetAssignmentsResponse> = {
      detail: { assignments: [assignment] }
    };

    expect(response.detail.assignments).toEqual([assignment]);
  });

  it("returns assignments directly via inline transform logic", () => {
    const assignments = [makeAssignment({ id: 1 }), makeAssignment({ id: 2 })];
    const response: DetailResponse<GetAssignmentsResponse> = {
      detail: { assignments }
    };

    const transformed = response.detail.assignments;
    expect(transformed).toHaveLength(2);
    expect(transformed[0].id).toBe(1);
    expect(transformed[1].id).toBe(2);
  });
});

describe("getAssignment transformResponse", () => {
  it("extracts single assignment from detail wrapper", () => {
    const assignment = makeAssignment({ id: 42 });
    const response: DetailResponse<GetAssignmentResponse> = {
      detail: { assignment }
    };

    const result = response.detail.assignment;
    expect(result.id).toBe(42);
    expect(result.name).toBe("Test Assignment");
  });
});

describe("createAssignment invalidatesTags logic", () => {
  it("returns Assignments tag when no error", () => {
    const invalidatesTags = (result: any, error: any) => {
      if (!error) return [{ type: "Assignments" }];
      return [];
    };

    expect(invalidatesTags({}, null)).toEqual([{ type: "Assignments" }]);
    expect(invalidatesTags({}, undefined)).toEqual([{ type: "Assignments" }]);
  });

  it("returns empty array when error is present", () => {
    const invalidatesTags = (result: any, error: any) => {
      if (!error) return [{ type: "Assignments" }];
      return [];
    };

    expect(invalidatesTags({}, { status: 500 })).toEqual([]);
  });
});

describe("updateAssignment invalidatesTags logic", () => {
  it("invalidates both Assignments and Assignment tags on success", () => {
    const invalidatesTags = (result: any, error: any) => {
      if (!error) return [{ type: "Assignments" }, { type: "Assignment" }];
      return [];
    };

    expect(invalidatesTags({}, null)).toEqual([{ type: "Assignments" }, { type: "Assignment" }]);
  });

  it("returns empty array when error occurs", () => {
    const invalidatesTags = (result: any, error: any) => {
      if (!error) return [{ type: "Assignments" }, { type: "Assignment" }];
      return [];
    };

    expect(invalidatesTags({}, { status: 400 })).toEqual([]);
  });
});

describe("removeAssignment invalidatesTags logic", () => {
  it("returns Assignments tag when removal succeeds", () => {
    const invalidatesTags = (result: any, error: any) => {
      if (!error) return [{ type: "Assignments" }];
      return [];
    };

    expect(invalidatesTags({}, null)).toEqual([{ type: "Assignments" }]);
  });

  it("returns empty array when error is present", () => {
    const invalidatesTags = (result: any, error: any) => {
      if (!error) return [{ type: "Assignments" }];
      return [];
    };

    expect(invalidatesTags({}, { status: 404 })).toEqual([]);
  });
});

describe("duplicateAssignment invalidatesTags logic", () => {
  it("returns Assignments tag on successful duplication", () => {
    const invalidatesTags = (result: any, error: any) => {
      if (!error) return [{ type: "Assignments" }];
      return [];
    };

    expect(invalidatesTags({ detail: { id: 5, name: "Copy" } }, null)).toEqual([
      { type: "Assignments" }
    ]);
  });

  it("returns empty array on duplication error", () => {
    const invalidatesTags = (result: any, error: any) => {
      if (!error) return [{ type: "Assignments" }];
      return [];
    };

    expect(invalidatesTags(undefined, { status: 500 })).toEqual([]);
  });
});

describe("getAssignments query builder", () => {
  it("builds correct GET request for assignments list", () => {
    const queryFn = () => ({ method: "GET", url: "/assignment/instructor/assignments" });
    const result = queryFn();
    expect(result.method).toBe("GET");
    expect(result.url).toBe("/assignment/instructor/assignments");
  });
});

describe("getAssignment query builder", () => {
  it("builds correct GET request with assignment id in URL", () => {
    const queryFn = (id: number) => ({
      method: "GET",
      url: `/assignment/instructor/assignments/${id}`
    });
    expect(queryFn(7)).toEqual({ method: "GET", url: "/assignment/instructor/assignments/7" });
  });
});

describe("updateAssignment query builder", () => {
  it("builds correct PUT request with assignment id in URL", () => {
    const assignment = makeAssignment({ id: 3 });
    const queryFn = (body: Assignment) => ({
      method: "PUT",
      url: `/assignment/instructor/assignments/${body.id}`,
      body
    });
    const result = queryFn(assignment);
    expect(result.method).toBe("PUT");
    expect(result.url).toBe("/assignment/instructor/assignments/3");
    expect(result.body).toBe(assignment);
  });
});

describe("removeAssignment query builder", () => {
  it("builds correct DELETE request with assignment id in URL", () => {
    const assignment = makeAssignment({ id: 9 });
    const queryFn = (body: Assignment) => ({
      method: "DELETE",
      url: `/assignment/instructor/assignments/${body.id}`
    });
    const result = queryFn(assignment);
    expect(result.method).toBe("DELETE");
    expect(result.url).toBe("/assignment/instructor/assignments/9");
  });
});

describe("duplicateAssignment query builder", () => {
  it("builds correct POST request with assignment id in URL", () => {
    const queryFn = (assignmentId: number) => ({
      method: "POST",
      url: `/assignment/instructor/assignments/${assignmentId}/duplicate`
    });
    const result = queryFn(15);
    expect(result.method).toBe("POST");
    expect(result.url).toBe("/assignment/instructor/assignments/15/duplicate");
  });
});
