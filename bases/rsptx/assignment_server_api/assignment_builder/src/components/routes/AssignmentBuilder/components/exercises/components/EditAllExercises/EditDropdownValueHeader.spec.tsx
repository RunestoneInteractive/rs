import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { EditDropdownValueHeader } from "./EditDropdownValueHeader";

const { mockUpdate } = vi.hoisted(() => ({
  mockUpdate: vi.fn()
}));

vi.mock("@store/assignmentExercise/assignmentExercise.logic.api", () => ({
  useUpdateAssignmentQuestionsMutation: () => [mockUpdate, { isLoading: false }]
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

import { notify } from "@components/ui/notify";

vi.mock("@/hooks/useExercisesSelector", () => ({
  useExercisesSelector: () => ({ assignmentExercises: [{ id: 1, question_json: {} }] })
}));

vi.mock("@/hooks/useTableDropdownOptions", () => ({
  useTableDropdownOptions: () => ({
    autograde: [
      { value: "pct_correct", label: "Pct correct" },
      { value: "all_or_nothing", label: "All or nothing" }
    ]
  })
}));

describe("EditDropdownValueHeader", () => {
  it("keeps the bulk-edit popover open after selecting an option in the inner dropdown", async () => {
    renderWithMantine(
      <EditDropdownValueHeader field="autograde" label="Autograde" defaultValue="" />
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Autograde for all exercises" }));
    expect(await screen.findByRole("button", { name: "Apply" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.click(await screen.findByRole("option", { name: "All or nothing" }));

    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("toasts the canonical count copy after a successful bulk apply", async () => {
    mockUpdate.mockResolvedValue({});
    renderWithMantine(
      <EditDropdownValueHeader field="autograde" label="Autograde" defaultValue="" />
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Autograde for all exercises" }));
    await userEvent.click(await screen.findByRole("button", { name: "Apply" }));

    expect(notify.success).toHaveBeenCalledWith("Updated 1 exercise");
  });

  it("toasts the canonical error copy when the bulk apply fails", async () => {
    mockUpdate.mockResolvedValue({ error: { status: 500 } });
    renderWithMantine(
      <EditDropdownValueHeader field="autograde" label="Autograde" defaultValue="" />
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Autograde for all exercises" }));
    await userEvent.click(await screen.findByRole("button", { name: "Apply" }));

    expect(notify.error).toHaveBeenCalledWith("Couldn't update exercises. Try again.");
  });
});
