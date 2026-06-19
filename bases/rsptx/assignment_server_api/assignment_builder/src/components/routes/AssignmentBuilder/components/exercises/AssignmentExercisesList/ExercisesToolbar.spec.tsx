import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { Exercise } from "@/types/exercises";

import { ExercisesToolbar } from "./ExercisesToolbar";

const { mockOpenConfirmModal } = vi.hoisted(() => ({
  mockOpenConfirmModal: vi.fn()
}));

vi.mock("@mantine/modals", async (importOriginal) => {
  const original = await importOriginal<typeof import("@mantine/modals")>();

  return {
    ...original,
    modals: { ...original.modals, openConfirmModal: mockOpenConfirmModal }
  };
});

const renderToolbar = (overrides: Partial<Parameters<typeof ExercisesToolbar>[0]> = {}) => {
  const props = {
    globalFilter: "",
    setGlobalFilter: vi.fn(),
    totalCount: 4,
    selectedExercises: [] as Exercise[],
    handleRemoveSelected: vi.fn(),
    setViewMode: vi.fn(),
    setResetExerciseForm: vi.fn(),
    ...overrides
  };
  const view = renderWithMantine(<ExercisesToolbar {...props} />);

  return { props, view };
};

describe("ExercisesToolbar", () => {
  it("renders the title, exercise count, and primary action", () => {
    renderToolbar();
    expect(screen.getByRole("heading", { name: "Exercises" })).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add exercise" })).toBeInTheDocument();
  });

  it("disables the remove button when nothing is selected", () => {
    renderToolbar({ selectedExercises: [] });

    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(mockOpenConfirmModal).not.toHaveBeenCalled();
  });

  it("asks for confirmation before removing the selected exercises", async () => {
    const handleRemoveSelected = vi.fn();

    renderToolbar({
      selectedExercises: [{ id: 1 } as unknown as Exercise, { id: 2 } as unknown as Exercise],
      handleRemoveSelected
    });

    await userEvent.click(screen.getByRole("button", { name: "Remove (2)" }));

    expect(handleRemoveSelected).not.toHaveBeenCalled();
    expect(mockOpenConfirmModal).toHaveBeenCalledTimes(1);

    mockOpenConfirmModal.mock.calls[0][0].onConfirm();
    expect(handleRemoveSelected).toHaveBeenCalledTimes(1);
  });

  it("uses the singular noun when confirming removal of one exercise", async () => {
    renderToolbar({ selectedExercises: [{ id: 1 } as unknown as Exercise] });

    await userEvent.click(screen.getByRole("button", { name: "Remove (1)" }));

    const { children } = mockOpenConfirmModal.mock.calls[0][0];
    const { container } = renderWithMantine(<>{children}</>);

    expect(container).toHaveTextContent("Remove 1 exercise from this assignment?");
  });

  it("uses the plural noun when confirming removal of several exercises", async () => {
    renderToolbar({
      selectedExercises: [{ id: 1 } as unknown as Exercise, { id: 2 } as unknown as Exercise]
    });

    await userEvent.click(screen.getByRole("button", { name: "Remove (2)" }));

    const { children } = mockOpenConfirmModal.mock.calls[0][0];
    const { container } = renderWithMantine(<>{children}</>);

    expect(container).toHaveTextContent("Remove 2 exercises from this assignment?");
  });

  it("switches to browse mode from the add menu", async () => {
    const setViewMode = vi.fn();

    renderToolbar({ setViewMode });

    await userEvent.click(screen.getByRole("button", { name: "Add exercise" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Choose from book" }));

    expect(setViewMode).toHaveBeenCalledWith("browse");
  });

  it("switches to search mode from the add menu", async () => {
    const setViewMode = vi.fn();

    renderToolbar({ setViewMode });

    await userEvent.click(screen.getByRole("button", { name: "Add exercise" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Search exercises" }));

    expect(setViewMode).toHaveBeenCalledWith("search");
  });

  it("resets the form and switches to create mode from the add menu", async () => {
    const setViewMode = vi.fn();
    const setResetExerciseForm = vi.fn();

    renderToolbar({ setViewMode, setResetExerciseForm });

    await userEvent.click(screen.getByRole("button", { name: "Add exercise" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Create exercise" }));

    expect(setResetExerciseForm).toHaveBeenCalledWith(true);
    expect(setViewMode).toHaveBeenCalledWith("create");
  });

  it("forwards search input changes", async () => {
    const setGlobalFilter = vi.fn();

    renderToolbar({ setGlobalFilter });

    await userEvent.type(screen.getByPlaceholderText("Search exercises…"), "a");
    expect(setGlobalFilter).toHaveBeenCalledWith("a");
  });
});
