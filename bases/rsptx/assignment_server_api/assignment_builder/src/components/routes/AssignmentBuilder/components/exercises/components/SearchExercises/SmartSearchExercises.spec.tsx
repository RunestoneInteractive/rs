import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { Exercise } from "@/types/exercises";

import { SmartSearchExercises } from "./SmartSearchExercises";

const {
  hookReturn,
  selectedHolder,
  updatingHolder,
  dispatchMock,
  updateAssignmentExercisesMock,
  setSelectedExercisesMock
} = vi.hoisted(() => ({
  hookReturn: {
    exercises: [
      { id: 1, name: "Ex One", question_type: "mchoice", qnumber: "Q1" },
      { id: 2, name: "Ex Two", question_type: "activecode", qnumber: "Q2" }
    ],
    pagination: { total: 2, page: 0, limit: 20, pages: 1 },
    loading: false,
    initialLoading: false,
    error: null as { status: number } | null,
    searchParams: {
      page: 0,
      limit: 20,
      use_base_course: true,
      sorting: { field: "name", order: 1 },
      filters: {}
    },
    filters: {
      global: { value: null },
      question_type: { value: null },
      name: { value: null },
      author: { value: null },
      topic: { value: null }
    },
    updateFilters: vi.fn(),
    updateSorting: vi.fn(),
    updatePagination: vi.fn(),
    onGlobalFilterChange: vi.fn(),
    toggleBaseCourse: vi.fn(),
    refetch: vi.fn()
  },
  selectedHolder: { value: [] as Exercise[] },
  updatingHolder: { value: false },
  dispatchMock: vi.fn(),
  updateAssignmentExercisesMock: vi.fn(),
  setSelectedExercisesMock: vi.fn((payload: Exercise[]) => ({ type: "SET_SELECTED", payload }))
}));

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector(undefined),
  useDispatch: () => dispatchMock
}));

vi.mock("@/hooks/useSmartExerciseSearch", () => ({
  useSmartExerciseSearch: () => hookReturn
}));

vi.mock("@/hooks/useUpdateAssignmentExercise", () => ({
  useUpdateAssignmentExercise: () => ({
    updateAssignmentExercises: updateAssignmentExercisesMock,
    isUpdating: updatingHolder.value
  })
}));

vi.mock("@store/searchExercises/searchExercises.logic", () => ({
  searchExercisesSelectors: { getSelectedExercises: () => selectedHolder.value },
  searchExercisesActions: { setSelectedExercises: setSelectedExercisesMock }
}));

vi.mock("@store/dataset/dataset.logic", () => ({
  datasetSelectors: {
    getQuestionTypeOptions: () => [
      { label: "Multiple Choice", value: "mchoice" },
      { label: "ActiveCode", value: "activecode" }
    ]
  }
}));

vi.mock("@components/ui/ExerciseTypeTag", () => ({
  ExerciseTypeTag: ({ type }: { type: string }) => <span>{type}</span>
}));

vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreviewModal",
  () => ({ ExercisePreviewModal: () => null })
);

vi.mock("../CopyExercise/CopyExerciseModal", () => ({ CopyExerciseModal: () => null }));

describe("SmartSearchExercises", () => {
  beforeEach(() => {
    selectedHolder.value = [];
    updatingHolder.value = false;
    hookReturn.error = null;
    dispatchMock.mockReset();
    updateAssignmentExercisesMock.mockReset();
    setSelectedExercisesMock.mockClear();
    hookReturn.updateSorting.mockReset();
  });

  it("renders the returned exercise rows", () => {
    renderWithMantine(<SmartSearchExercises />);
    expect(screen.getByText("Ex One")).toBeInTheDocument();
    expect(screen.getByText("Ex Two")).toBeInTheDocument();
  });

  it("requests descending sort when the ascending Name header is clicked", async () => {
    renderWithMantine(<SmartSearchExercises />);
    await userEvent.click(screen.getByText("Name"));
    expect(hookReturn.updateSorting).toHaveBeenCalledWith("name", -1);
  });

  it("cycles back to ascending when the descending Name header is clicked again", async () => {
    hookReturn.searchParams.sorting.order = -1;

    renderWithMantine(<SmartSearchExercises />);
    await userEvent.click(screen.getByText("Name"));

    expect(hookReturn.updateSorting).toHaveBeenCalledWith("name", 1);

    hookReturn.searchParams.sorting.order = 1;
  });

  it("dispatches the selected exercise when a row checkbox is toggled", async () => {
    renderWithMantine(<SmartSearchExercises />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Ex One" }));

    expect(setSelectedExercisesMock).toHaveBeenCalledWith([expect.objectContaining({ id: 1 })]);
    expect(dispatchMock).toHaveBeenCalledWith({
      type: "SET_SELECTED",
      payload: [expect.objectContaining({ id: 1 })]
    });
  });

  it("shows the add action and adds the selected exercises to the assignment", async () => {
    selectedHolder.value = [{ id: 1 } as Exercise];
    renderWithMantine(<SmartSearchExercises />);

    await userEvent.click(screen.getByRole("button", { name: /Add 1 selected/ }));
    expect(updateAssignmentExercisesMock).toHaveBeenCalledWith(
      { idsToAdd: [1], isReading: false },
      expect.any(Function)
    );
  });

  it("toggles the base-course filter via the switch", async () => {
    renderWithMantine(<SmartSearchExercises />);
    await userEvent.click(screen.getByRole("switch"));
    expect(hookReturn.toggleBaseCourse).toHaveBeenCalledWith(false);
  });

  it("renders the toolbar title with the total result count", () => {
    renderWithMantine(<SmartSearchExercises />);
    expect(screen.getByRole("heading", { name: "Search exercises" })).toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 2 exercises")).toBeInTheDocument();
  });

  it("returns to the list view from the toolbar back button", async () => {
    const setViewMode = vi.fn();

    renderWithMantine(<SmartSearchExercises setViewMode={setViewMode} />);
    await userEvent.click(screen.getByRole("button", { name: "Back to exercises" }));
    expect(setViewMode).toHaveBeenCalledWith("list");
  });

  it("discards the staged selection when going back to the list", async () => {
    selectedHolder.value = [{ id: 1 } as Exercise, { id: 2 } as Exercise];
    const setViewMode = vi.fn();

    renderWithMantine(<SmartSearchExercises setViewMode={setViewMode} />);
    await userEvent.click(screen.getByRole("button", { name: "Back to exercises" }));

    expect(setSelectedExercisesMock).toHaveBeenCalledWith([]);
    expect(setViewMode).toHaveBeenCalledWith("list");
  });

  it("marks the add button as loading while the update is in flight", () => {
    selectedHolder.value = [{ id: 1 } as Exercise];
    updatingHolder.value = true;

    renderWithMantine(<SmartSearchExercises />);

    const addButton = screen.getByRole("button", { name: /Add 1 selected/ });

    expect(addButton).toBeDisabled();
    expect(addButton).toHaveAttribute("data-loading");
  });

  it("shows the search error state with retry copy", () => {
    hookReturn.error = { status: 500 };

    renderWithMantine(<SmartSearchExercises />);

    expect(screen.getByRole("heading", { name: "Couldn't search exercises" })).toBeInTheDocument();
    expect(screen.getByText("Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("uses a real ellipsis in the search placeholder", () => {
    renderWithMantine(<SmartSearchExercises />);
    expect(screen.getByPlaceholderText("Search terms…")).toBeInTheDocument();
  });

  it("omits the back button when no view-mode setter is provided", () => {
    renderWithMantine(<SmartSearchExercises />);
    expect(screen.queryByRole("button", { name: "Back to exercises" })).toBeNull();
  });

  it("renders question names in the mono cell treatment", () => {
    const { container } = renderWithMantine(<SmartSearchExercises />);
    const monoCells = container.querySelectorAll("[data-mono-name]");

    expect(monoCells.length).toBe(2);
    expect(monoCells[0].textContent).toBe("Ex One");
  });
});
