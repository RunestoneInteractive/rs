import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { Exercise } from "@/types/exercises";
import { TreeNode } from "@/types/treeNode";

import { ChooseExercises, getApplyChangesConfirmMessage } from "./ChooseExercises";

const {
  dispatchMock,
  storeHolder,
  updateAssignmentExercisesMock,
  navigateToExercisesMock,
  updateExerciseViewModeMock,
  openConfirmModalMock,
  resetSelectionsActionMock
} = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
  storeHolder: {
    selectedExercises: [] as Exercise[],
    exercisesToAdd: [] as Exercise[],
    exercisesToRemove: [] as Exercise[],
    availableExercises: [] as unknown[]
  },
  updateAssignmentExercisesMock: vi.fn(),
  navigateToExercisesMock: vi.fn(),
  updateExerciseViewModeMock: vi.fn(),
  openConfirmModalMock: vi.fn(),
  resetSelectionsActionMock: vi.fn(() => ({ type: "chooseExercises/resetSelections" }))
}));

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector(undefined),
  useDispatch: () => dispatchMock
}));

vi.mock("@store/chooseExercises/chooseExercises.logic", () => ({
  chooseExercisesSelectors: {
    getSelectedKeys: () => ({}),
    getSelectedExercises: () => storeHolder.selectedExercises,
    getExercisesToAdd: () => storeHolder.exercisesToAdd,
    getExercisesToRemove: () => storeHolder.exercisesToRemove
  },
  chooseExercisesActions: {
    setSelectedKeys: vi.fn((payload) => ({ type: "chooseExercises/setSelectedKeys", payload })),
    setSelectedExercises: vi.fn((payload) => ({
      type: "chooseExercises/setSelectedExercises",
      payload
    })),
    setExercisesToAdd: vi.fn((payload) => ({
      type: "chooseExercises/setExercisesToAdd",
      payload
    })),
    setExercisesToRemove: vi.fn((payload) => ({
      type: "chooseExercises/setExercisesToRemove",
      payload
    })),
    resetSelections: resetSelectionsActionMock
  }
}));

vi.mock("@store/exercises/exercises.logic", () => ({
  exercisesSelectors: { getAvailableExercises: () => storeHolder.availableExercises }
}));

vi.mock("@store/dataset/dataset.logic", () => ({
  datasetSelectors: {
    getQuestionTypeOptions: () => [{ label: "Multiple Choice", value: "mchoice" }]
  }
}));

vi.mock("@/hooks/useExercisesSelector", () => ({
  useExercisesSelector: () => ({ assignmentExercises: [] })
}));

vi.mock("@/hooks/useSelectedAssignment", () => ({
  useSelectedAssignment: () => ({ selectedAssignment: { id: 7 } })
}));

vi.mock("@/hooks/useUpdateAssignmentExercise", () => ({
  useUpdateAssignmentExercise: () => ({
    updateAssignmentExercises: updateAssignmentExercisesMock
  })
}));

vi.mock("@components/routes/AssignmentBuilder/hooks/useAssignmentRouting", () => ({
  useAssignmentRouting: () => ({
    navigateToExercises: navigateToExercisesMock,
    updateExerciseViewMode: updateExerciseViewModeMock
  })
}));

vi.mock("@components/shell/useScrollShadow", () => ({
  useScrollShadow: () => ({ sentinelRef: vi.fn(), scrolled: false })
}));

vi.mock("@mantine/modals", async (importOriginal) => {
  const original = await importOriginal<typeof import("@mantine/modals")>();

  return {
    ...original,
    modals: { ...original.modals, openConfirmModal: openConfirmModalMock }
  };
});

vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreviewModal",
  () => ({ ExercisePreviewModal: () => null })
);

const EXERCISES_TREE: TreeNode[] = [
  {
    key: "Chapter 1",
    data: { title: "Chapter 1" },
    children: [
      {
        key: "q-book",
        data: {
          id: 1,
          title: "Book Q",
          name: "q-book",
          question_type: "mchoice",
          from_source: true
        }
      },
      {
        key: "q-user",
        data: {
          id: 2,
          title: "User Q",
          name: "q-user",
          question_type: "mchoice",
          from_source: false
        }
      }
    ]
  } as TreeNode
];

describe("getApplyChangesConfirmMessage", () => {
  it("names the add-only change with a pluralized noun", () => {
    expect(getApplyChangesConfirmMessage(1, 0)).toBe("Add 1 exercise to this assignment?");
    expect(getApplyChangesConfirmMessage(5, 0)).toBe("Add 5 exercises to this assignment?");
  });

  it("names the remove-only change with a pluralized noun", () => {
    expect(getApplyChangesConfirmMessage(0, 1)).toBe("Remove 1 exercise from this assignment?");
    expect(getApplyChangesConfirmMessage(0, 3)).toBe("Remove 3 exercises from this assignment?");
  });

  it("combines both changes with the noun agreeing with the trailing count", () => {
    expect(getApplyChangesConfirmMessage(2, 1)).toBe(
      "Add 2 and remove 1 exercise in this assignment?"
    );
    expect(getApplyChangesConfirmMessage(1, 2)).toBe(
      "Add 1 and remove 2 exercises in this assignment?"
    );
  });
});

describe("ChooseExercises", () => {
  beforeEach(() => {
    storeHolder.selectedExercises = [];
    storeHolder.exercisesToAdd = [];
    storeHolder.exercisesToRemove = [];
    storeHolder.availableExercises = [];
    dispatchMock.mockClear();
    updateAssignmentExercisesMock.mockClear();
    navigateToExercisesMock.mockClear();
    updateExerciseViewModeMock.mockClear();
    openConfirmModalMock.mockClear();
    resetSelectionsActionMock.mockClear();
  });

  it("renders the toolbar title and a no-changes footer with disabled actions", () => {
    renderWithMantine(<ChooseExercises />);

    expect(screen.getByRole("heading", { name: "Choose from book" })).toBeInTheDocument();
    expect(screen.getByText("No changes yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("summarizes staged additions and removals in the footer", () => {
    storeHolder.exercisesToAdd = [{ id: 1 } as Exercise, { id: 2 } as Exercise];
    storeHolder.exercisesToRemove = [{ id: 3 } as Exercise];

    renderWithMantine(<ChooseExercises />);

    expect(screen.getByText("2 to add · 1 to remove")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply changes" })).toBeEnabled();
  });

  it("asks for confirmation before applying and then saves and navigates back", async () => {
    storeHolder.exercisesToAdd = [{ id: 1 } as Exercise];
    storeHolder.exercisesToRemove = [{ id: 3 } as Exercise];
    updateAssignmentExercisesMock.mockResolvedValue(undefined);

    renderWithMantine(<ChooseExercises />);

    await userEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    expect(updateAssignmentExercisesMock).not.toHaveBeenCalled();
    expect(openConfirmModalMock).toHaveBeenCalledTimes(1);
    expect(openConfirmModalMock.mock.calls[0][0].title).toBe("Apply changes");
    expect(openConfirmModalMock.mock.calls[0][0].children.props.children).toBe(
      "Add 1 and remove 1 exercise in this assignment?"
    );

    await openConfirmModalMock.mock.calls[0][0].onConfirm();

    expect(updateAssignmentExercisesMock).toHaveBeenCalledWith({
      idsToAdd: [1],
      idsToRemove: [3],
      isReading: false
    });
    expect(navigateToExercisesMock).toHaveBeenCalledWith("7");
  });

  it("discards staged changes and returns to the list on cancel", async () => {
    storeHolder.exercisesToAdd = [{ id: 1 } as Exercise];

    renderWithMantine(<ChooseExercises />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(resetSelectionsActionMock).toHaveBeenCalledTimes(1);
    expect(updateExerciseViewModeMock).toHaveBeenCalledWith("list");
  });

  it("returns to the list from the toolbar back button", async () => {
    renderWithMantine(<ChooseExercises />);

    await userEvent.click(screen.getByRole("button", { name: "Back to exercises" }));

    expect(resetSelectionsActionMock).toHaveBeenCalledTimes(1);
    expect(updateExerciseViewModeMock).toHaveBeenCalledWith("list");
  });

  it("labels the source indicators for book and user-created exercises", async () => {
    storeHolder.availableExercises = EXERCISES_TREE;

    renderWithMantine(<ChooseExercises />);

    await userEvent.click(screen.getByRole("button", { name: "Expand Chapter 1" }));

    expect(screen.getByRole("button", { name: "From book" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "User created" })).toBeInTheDocument();
  });

  it("shows the source tooltip when the indicator is hovered", async () => {
    storeHolder.availableExercises = EXERCISES_TREE;

    renderWithMantine(<ChooseExercises />);

    await userEvent.click(screen.getByRole("button", { name: "Expand Chapter 1" }));
    await userEvent.hover(screen.getByRole("button", { name: "From book" }));

    expect(await screen.findByText("From book")).toBeInTheDocument();
  });
});
