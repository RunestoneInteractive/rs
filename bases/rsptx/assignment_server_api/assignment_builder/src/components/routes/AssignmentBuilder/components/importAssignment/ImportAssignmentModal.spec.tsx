import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen, waitFor } from "@/test/renderWithMantine";
import { ShareableTreeCourse } from "@/types/assignmentSharing";

import {
  ImportAssignmentModal,
  buildSelectionKeys,
  buildTree
} from "./ImportAssignmentModal";

const {
  treeHolder,
  previewHolder,
  importMock,
  importCourseMock,
  treeSkipSpy,
  treeParamsSpy
} = vi.hoisted(
  () => ({
    treeHolder: {
      value: {
        courses: [
          {
            id: 7,
            course_name: "cs101-fall",
            institution: "State University",
            base_course: "thinkcspy",
            book_title: "How to Think Like a Computer Scientist",
            shareable_count: 2,
            is_official: false,
            is_mine: false,
            assignments: [
              {
                id: 1,
                name: "Loops Homework",
                description: "Week 3",
                points: 40,
                kind: "Regular",
                question_count: 10,
                is_official: false,
                already_imported: false,
                imported_as: null
              },
              {
                id: 2,
                name: "Recursion Set",
                description: null,
                points: 20,
                kind: "Regular",
                question_count: 4,
                is_official: false,
                already_imported: false,
                imported_as: null
              }
            ]
          },
          {
            id: 8,
            course_name: "thinkcspy",
            institution: null,
            base_course: "thinkcspy",
            book_title: "How to Think Like a Computer Scientist",
            shareable_count: 1,
            is_official: true,
            is_mine: false,
            assignments: [
              {
                id: 3,
                name: "Chapter 1 Exercises",
                description: null,
                points: 10,
                kind: "Regular",
                question_count: 5,
                is_official: true,
                already_imported: true,
                imported_as: "Chapter 1 Exercises"
              }
            ]
          }
        ] as ShareableTreeCourse[],
        pagination: { total: 2, page: 0, limit: 25, pages: 1 }
      }
    },
    previewHolder: {
      value: {
        id: 1,
        name: "Loops Homework",
        description: "Week 3",
        points: 40,
        kind: "Regular",
        duedate: "2099-01-01T00:00:00",
        question_count: 2,
        course_name: "cs101-fall",
        base_course: "thinkcspy",
        book_title: "How to Think Like a Computer Scientist",
        institution: "State University",
        is_official: false,
        sharing_description: "",
        is_cross_book: false,
        already_imported: false,
        imported_as: null,
        skipped_readings: 0,
        questions: [
          {
            id: 11,
            name: "q_loop_1",
            question_type: "mchoice",
            points: 5,
            chapter: "ch1",
            subchapter: "sub1",
            reading_assignment: false,
            will_import: true
          }
        ]
      }
    },
    importMock: vi.fn(),
    importCourseMock: vi.fn(),
    treeSkipSpy: vi.fn(),
    treeParamsSpy: vi.fn()
  })
);

vi.mock("@store/assignment/assignment.logic.api", () => ({
  useShareableTreeQuery: (params: unknown, options: { skip: boolean }) => {
    treeSkipSpy(options.skip);
    treeParamsSpy(params);
    return { data: treeHolder.value, isFetching: false };
  },
  useImportAssignmentMutation: () => [importMock, { isLoading: false }],
  useImportCourseAssignmentsMutation: () => [importCourseMock, { isLoading: false }],
  usePreviewSharedAssignmentQuery: () => ({
    data: previewHolder.value,
    isFetching: false
  })
}));

const onHide = vi.fn();

const resolved = (value: unknown) => ({ unwrap: () => Promise.resolve(value) });

describe("buildTree", () => {
  it("namespaces keys so a course and an assignment can share an id", () => {
    // Course 7 and assignment 1 would collide on a bare id, and TreeTable keys
    // its whole selection map by node key.
    const tree = buildTree(treeHolder.value.courses);

    expect(tree[0].key).toBe("course:7");
    expect(tree[0].children?.[0].key).toBe("assignment:1");
  });
});

describe("buildSelectionKeys", () => {
  const courses = () => treeHolder.value.courses;

  it("marks a course checked only when all of its assignments are", () => {
    const keys = buildSelectionKeys(courses(), new Set([1, 2]));

    expect(keys["course:7"]).toEqual({ checked: true, partialChecked: false });
  });

  it("marks a course partially checked when only some are", () => {
    const keys = buildSelectionKeys(courses(), new Set([1]));

    expect(keys["course:7"]).toEqual({ checked: false, partialChecked: true });
    expect(keys["assignment:1"].checked).toBe(true);
    expect(keys["assignment:2"].checked).toBe(false);
  });

  it("leaves a course unchecked when nothing under it is selected", () => {
    const keys = buildSelectionKeys(courses(), new Set());

    expect(keys["course:7"]).toEqual({ checked: false, partialChecked: false });
  });
});

describe("ImportAssignmentModal", () => {
  beforeEach(() => {
    onHide.mockReset();
    importMock.mockReset();
    importCourseMock.mockReset();
    importMock.mockReturnValue(resolved({ detail: { id: 5, name: "Loops Homework" } }));
    importCourseMock.mockReturnValue(resolved({ detail: { imported: ["a"] } }));
    treeSkipSpy.mockReset();
    treeParamsSpy.mockReset();
  });

  it("lists the courses that have assignments to offer", () => {
    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);

    expect(screen.getByText("cs101-fall")).toBeInTheDocument();
    expect(screen.getByText("thinkcspy")).toBeInTheDocument();
    expect(screen.getByText("2 assignments")).toBeInTheDocument();
  });

  it("keeps a course's assignments collapsed until it is expanded", async () => {
    const user = userEvent.setup();

    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);

    expect(screen.queryByText("Loops Homework")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand cs101-fall" }));

    expect(screen.getByText("Loops Homework")).toBeInTheDocument();
    expect(screen.getByText("Recursion Set")).toBeInTheDocument();
  });

  it("narrows the list to the caller's own book", async () => {
    const user = userEvent.setup();

    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);
    await user.click(screen.getByLabelText("Only for this book"));

    expect(treeParamsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ use_base_course: true, only_my_courses: false })
    );
  });

  it("narrows the list to courses the instructor teaches", async () => {
    // Independent of the book filter, so the two apply together.
    const user = userEvent.setup();

    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);
    await user.click(screen.getByLabelText("Only courses I teach"));

    expect(treeParamsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ use_base_course: false, only_my_courses: true })
    );
  });

  it("marks the book's own course as official", () => {
    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);

    expect(screen.getByText("Official")).toBeInTheDocument();
  });

  it("does not load the tree until the modal is opened", () => {
    // The modal stays mounted so it can animate, so a naive implementation
    // would query every course on the platform on every render.
    renderWithMantine(<ImportAssignmentModal visible={false} onHide={onHide} />);

    expect(treeSkipSpy).toHaveBeenCalledWith(true);
  });

  it("imports a whole course through the bulk endpoint when it is checked", async () => {
    const user = userEvent.setup();

    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);
    await user.click(screen.getByRole("checkbox", { name: "Select cs101-fall" }));

    expect(
      screen.getByRole("button", { name: "Import 2 assignments" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import 2 assignments" }));

    // One request rather than two, so anything added to that course since the
    // tree loaded comes across too.
    expect(importCourseMock).toHaveBeenCalledWith(7);
    expect(importMock).not.toHaveBeenCalled();
    expect(onHide).toHaveBeenCalled();
  });

  it("imports one at a time when only part of a course is checked", async () => {
    const user = userEvent.setup();

    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);
    await user.click(screen.getByRole("button", { name: "Expand cs101-fall" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Loops Homework" }));
    await user.click(screen.getByRole("button", { name: "Import 1 assignment" }));

    expect(importMock).toHaveBeenCalledWith(1);
    expect(importCourseMock).not.toHaveBeenCalled();
  });

  it("does not select an assignment already in this course", async () => {
    // Selecting one would promise something the import then skips, so the count
    // on the button would contradict what happens.
    const user = userEvent.setup();

    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);
    await user.click(screen.getByRole("checkbox", { name: "Select thinkcspy" }));

    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("marks an assignment already in this course", async () => {
    const user = userEvent.setup();

    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);
    await user.click(screen.getByRole("button", { name: "Expand thinkcspy" }));

    expect(screen.getByText("Imported")).toBeInTheDocument();
  });

  it("disables import until something is selected", () => {
    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);

    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("stays open when an import fails", async () => {
    const user = userEvent.setup();

    importCourseMock.mockReturnValue({ unwrap: () => Promise.reject(new Error("nope")) });

    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);
    await user.click(screen.getByRole("checkbox", { name: "Select cs101-fall" }));
    await user.click(screen.getByRole("button", { name: "Import 2 assignments" }));

    await waitFor(() => expect(importCourseMock).toHaveBeenCalled());
    expect(onHide).not.toHaveBeenCalled();
  });

  it("opens the question list from an assignment's preview button", async () => {
    const user = userEvent.setup();

    renderWithMantine(<ImportAssignmentModal visible onHide={onHide} />);
    await user.click(screen.getByRole("button", { name: "Expand cs101-fall" }));
    await user.click(screen.getAllByRole("button", { name: "Preview" })[0]);

    expect(await screen.findByText("q_loop_1")).toBeInTheDocument();
  });
});
