import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { Exercise } from "@/types/exercises";

import { AssignmentExercisesTable } from "./AssignmentExercisesTable";

const { mockReorder, mockUpdate } = vi.hoisted(() => ({
  mockReorder: vi.fn(),
  mockUpdate: vi.fn()
}));

vi.mock("@store/assignmentExercise/assignmentExercise.logic.api", () => ({
  useReorderAssignmentExercisesMutation: () => [mockReorder],
  useUpdateAssignmentQuestionsMutation: () => [mockUpdate, { isLoading: false }],
  useHasApiKeyQuery: () => ({ data: { hasApiKey: true, asyncLlmModesEnabled: true } })
}));

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

vi.mock("@/hooks/useJwtUser", () => ({
  useJwtUser: () => ({ username: "testuser1" })
}));

vi.mock("@/hooks/useSelectedAssignment", () => ({
  useSelectedAssignment: () => ({
    selectedAssignment: { id: 1, kind: "Peer", peer_async_visible: true }
  })
}));

vi.mock("@/hooks/useExercisesSelector", () => ({
  useExercisesSelector: () => ({ assignmentExercises: [] })
}));

vi.mock("@components/ui/EditableTable/EditableCellFactory", () => ({
  EditableCellFactory: ({ value }: { value: number | string }) => <span>{value}</span>
}));

vi.mock("@components/ui/ExerciseTypeTag", () => ({
  ExerciseTypeTag: ({ type }: { type: string }) => <span>{type}</span>
}));

vi.mock("@components/ui/EditableTable/TableOverlay", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@components/ui/EditableTable/TableOverlay")>();

  return {
    getRangeUpdateToastCopy: original.getRangeUpdateToastCopy,
    TableSelectionOverlay: () => null
  };
});

vi.mock("../components/EditAllExercises/EditDropdownValueHeader", () => ({
  EditDropdownValueHeader: ({ label }: { label: string }) => <span>{label}</span>
}));

vi.mock("../components/EditAllExercises/EditInputValueHeader", () => ({
  EditInputValueHeader: ({ label }: { label: string }) => <span>{label}</span>
}));

vi.mock("../components/CopyExercise/CopyExerciseModal", () => ({
  CopyExerciseModal: ({ visible }: { visible: boolean }) =>
    visible ? <div role="dialog" aria-label="Copy exercise" /> : null
}));

const EXERCISES: Exercise[] = [
  {
    id: 11,
    name: "exercise_one",
    title: "Exercise one",
    qnumber: "q-1",
    owner: "testuser1",
    question_type: "mchoice",
    question_json: { statement: "s" },
    htmlsrc: "<div>preview</div>",
    autograde: "pct_correct",
    which_to_grade: "best_answer",
    points: 2,
    use_llm: false,
    author: "Author A",
    difficulty: 2,
    tags: "loops",
    chapter: "ch1"
  },
  {
    id: 12,
    name: "exercise_two",
    title: "Exercise two",
    qnumber: "q-2",
    owner: "someone_else",
    question_type: "youtube",
    question_json: null,
    htmlsrc: "",
    autograde: "pct_correct",
    which_to_grade: "best_answer",
    points: 1,
    use_llm: false
  }
] as unknown as Exercise[];

const baseProps = {
  assignmentExercises: EXERCISES,
  selectedExercises: [] as Exercise[],
  setSelectedExercises: vi.fn(),
  globalFilter: "",
  setCurrentEditExercise: vi.fn(),
  setViewMode: vi.fn(),
  startItemId: null,
  draggingFieldName: null,
  handleMouseDown: vi.fn(),
  handleMouseUp: vi.fn(),
  handleChange: vi.fn()
};

describe("AssignmentExercisesTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the row actions as labelled buttons", () => {
    renderWithMantine(<AssignmentExercisesTable {...baseProps} />);

    expect(screen.getAllByRole("button", { name: "Exercise details" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Preview exercise" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Edit exercise" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Copy exercise" })).toHaveLength(1);
  });

  it("opens the editor when the edit button is activated", async () => {
    const setCurrentEditExercise = vi.fn();
    const setViewMode = vi.fn();

    renderWithMantine(
      <AssignmentExercisesTable
        {...baseProps}
        setCurrentEditExercise={setCurrentEditExercise}
        setViewMode={setViewMode}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit exercise" }));

    expect(setCurrentEditExercise).toHaveBeenCalledWith(EXERCISES[0]);
    expect(setViewMode).toHaveBeenCalledWith("edit");
  });

  it("opens the copy modal from the copy button", async () => {
    renderWithMantine(<AssignmentExercisesTable {...baseProps} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy exercise" }));

    expect(screen.getByRole("dialog", { name: "Copy exercise" })).toBeInTheDocument();
  });

  it("shows the details tooltip from the info button", async () => {
    renderWithMantine(<AssignmentExercisesTable {...baseProps} />);

    const [infoButton] = screen.getAllByRole("button", { name: "Exercise details" });

    await userEvent.hover(infoButton);

    expect(await screen.findByText(/Author: Author A/)).toBeInTheDocument();
  });

  it("titles the ellipsized exercise name and number cells", () => {
    renderWithMantine(<AssignmentExercisesTable {...baseProps} />);

    expect(screen.getByText("exercise_one")).toHaveAttribute("title", "exercise_one");
    expect(screen.getByText("q-1")).toHaveAttribute("title", "q-1");
  });

  it("labels the per-row async-mode select after the exercise", () => {
    renderWithMantine(<AssignmentExercisesTable {...baseProps} />);

    expect(
      screen.getByRole("textbox", { name: "Async mode for exercise_one" })
    ).toBeInTheDocument();
    expect(screen.getByText("Async mode")).toBeInTheDocument();
    expect(screen.queryByText("Async Mode")).not.toBeInTheDocument();
  });
});
