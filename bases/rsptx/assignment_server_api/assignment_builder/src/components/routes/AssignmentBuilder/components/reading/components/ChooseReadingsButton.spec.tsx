import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";
import { TreeNode } from "@/types/treeNode";

import { ChooseReadingsButton } from "./ChooseReadingsButton";

const { mockUpdate, mockReadingsSelector, updatingHolder, READINGS_TREE } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockReadingsSelector: vi.fn(),
  updatingHolder: { value: false },
  READINGS_TREE: [
    {
      key: "chapter-1",
      data: { title: "Chapter 1" },
      children: [
        { key: "sec-1", data: { title: "Section 1", id: 11 } },
        { key: "sec-2", data: { title: "Section 2", id: 12 } }
      ]
    }
  ] as TreeNode[]
}));

vi.mock("react-redux", () => ({
  useSelector: () => READINGS_TREE
}));

vi.mock("@/hooks/useUpdateAssignmentExercise", () => ({
  useUpdateAssignmentExercise: () => ({
    updateAssignmentExercises: mockUpdate,
    isUpdating: updatingHolder.value
  })
}));

vi.mock("@/hooks/useReadingsSelector", () => ({
  useReadingsSelector: () => mockReadingsSelector()
}));

describe("ChooseReadingsButton", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockReadingsSelector.mockReset();
    mockReadingsSelector.mockReturnValue({ selectedKeys: {}, readingExercises: [] });
    updatingHolder.value = false;
  });

  it("reveals the readings tree when the button is clicked", async () => {
    renderWithMantine(<ChooseReadingsButton />);
    expect(screen.queryByText("Chapter 1")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Choose readings" }));
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
  });

  it("adds the selected leaf readings on select", async () => {
    renderWithMantine(<ChooseReadingsButton />);
    await userEvent.click(screen.getByRole("button", { name: "Choose readings" }));
    await userEvent.click(screen.getByRole("button", { name: "Expand Chapter 1" }));

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Section 1" }));

    expect(mockUpdate).toHaveBeenCalledWith({ idsToAdd: [11], isReading: true });
  });

  it("removes the matching assignment readings on unselect", async () => {
    mockReadingsSelector.mockReturnValue({
      selectedKeys: { "sec-1": { checked: true, partialChecked: false } },
      readingExercises: [{ id: 99, question_id: 11 }]
    });

    renderWithMantine(<ChooseReadingsButton />);
    await userEvent.click(screen.getByRole("button", { name: "Choose readings" }));
    await userEvent.click(screen.getByRole("button", { name: "Expand Chapter 1" }));

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Section 1" }));

    expect(mockUpdate).toHaveBeenCalledWith({ idsToRemove: [99], isReading: true });
  });

  it("shows the selected section count in the footer and closes on Done", async () => {
    mockReadingsSelector.mockReturnValue({
      selectedKeys: {},
      readingExercises: [
        { id: 1, question_id: 11 },
        { id: 2, question_id: 12 }
      ]
    });

    renderWithMantine(<ChooseReadingsButton />);
    await userEvent.click(screen.getByRole("button", { name: "Choose readings" }));

    expect(screen.getByText("2 sections selected")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText("2 sections selected")).not.toBeInTheDocument();
  });

  it("ignores tree clicks while an update is in flight", async () => {
    updatingHolder.value = true;

    renderWithMantine(<ChooseReadingsButton />);
    await userEvent.click(screen.getByRole("button", { name: "Choose readings" }));
    await userEvent.click(screen.getByRole("button", { name: "Expand Chapter 1" }));

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Section 1" }));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("uses the singular form for a single selected section", async () => {
    mockReadingsSelector.mockReturnValue({
      selectedKeys: {},
      readingExercises: [{ id: 1, question_id: 11 }]
    });

    renderWithMantine(<ChooseReadingsButton />);
    await userEvent.click(screen.getByRole("button", { name: "Choose readings" }));

    expect(screen.getByText("1 section selected")).toBeInTheDocument();
  });
});
