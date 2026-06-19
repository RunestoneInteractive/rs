import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ManualTotalControl } from "./ManualTotalControl";

const { mockSetManualTotal, mockNotify } = vi.hoisted(() => ({
  mockSetManualTotal: vi.fn(),
  mockNotify: { success: vi.fn(), error: vi.fn() }
}));

vi.mock("@store/grader/grader.logic.api", () => ({
  useSetManualTotalMutation: () => [mockSetManualTotal, { isLoading: false }]
}));

vi.mock("@/components/ui/notify", () => ({ notify: mockNotify }));

const baseProps = {
  assignmentId: 7,
  sid: "s1",
  studentName: "Stu One",
  assignmentName: "Quiz 1",
  maxPoints: 10
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSetManualTotal.mockReturnValue({ unwrap: () => Promise.resolve({}) });
});

describe("ManualTotalControl", () => {
  it("renders an em dash for a cell without a score", () => {
    renderWithMantine(<ManualTotalControl {...baseProps} score={null} manual={false} />);
    expect(screen.getByRole("button", { name: /Edit total for Stu One/ })).toHaveTextContent("—");
  });

  it("renders the score for a graded cell", () => {
    renderWithMantine(<ManualTotalControl {...baseProps} score={8} manual={false} />);
    expect(screen.getByRole("button", { name: /Edit total/ })).toHaveTextContent("8");
  });

  it("opens the popover and shows the Computed badge for a non-manual cell", async () => {
    renderWithMantine(<ManualTotalControl {...baseProps} score={8} manual={false} />);
    await userEvent.click(screen.getByRole("button", { name: /Edit total/ }));
    expect(screen.getByText("Computed")).toBeInTheDocument();
  });

  it("shows the Manual badge for a manual cell", async () => {
    renderWithMantine(<ManualTotalControl {...baseProps} score={8} manual={true} />);
    await userEvent.click(screen.getByRole("button", { name: /Edit total/ }));
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("sets a manual total and notifies on success", async () => {
    renderWithMantine(<ManualTotalControl {...baseProps} score={8} manual={false} />);
    await userEvent.click(screen.getByRole("button", { name: /Edit total/ }));
    await userEvent.click(screen.getByRole("button", { name: "Set total" }));

    expect(mockSetManualTotal).toHaveBeenCalledWith({
      assignment_id: 7,
      sid: "s1",
      score: 8,
      manual: true
    });
    expect(mockNotify.success).toHaveBeenCalled();
  });

  it("disables revert for a non-manual cell and reverts a manual cell", async () => {
    const { rerender } = renderWithMantine(
      <ManualTotalControl {...baseProps} score={8} manual={false} />
    );
    await userEvent.click(screen.getByRole("button", { name: /Edit total/ }));
    expect(screen.getByRole("button", { name: "Revert to computed" })).toBeDisabled();

    rerender(<ManualTotalControl {...baseProps} score={8} manual={true} />);
    await userEvent.click(screen.getByRole("button", { name: /Edit total/ }));
    await userEvent.click(screen.getByRole("button", { name: "Revert to computed" }));

    expect(mockSetManualTotal).toHaveBeenCalledWith({
      assignment_id: 7,
      sid: "s1",
      manual: false
    });
  });

  it("notifies an error when the mutation rejects", async () => {
    mockSetManualTotal.mockReturnValue({ unwrap: () => Promise.reject(new Error("boom")) });
    renderWithMantine(<ManualTotalControl {...baseProps} score={8} manual={false} />);
    await userEvent.click(screen.getByRole("button", { name: /Edit total/ }));
    await userEvent.click(screen.getByRole("button", { name: "Set total" }));

    expect(mockNotify.error).toHaveBeenCalled();
  });
});
