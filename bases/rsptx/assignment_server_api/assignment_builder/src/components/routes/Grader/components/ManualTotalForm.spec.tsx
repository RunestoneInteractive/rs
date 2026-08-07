import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ManualTotalForm } from "./ManualTotalForm";

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
  maxPoints: 10
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSetManualTotal.mockReturnValue({ unwrap: () => Promise.resolve({}) });
});

describe("ManualTotalForm", () => {
  it("shows the Computed badge and current score for a non-manual cell", () => {
    renderWithMantine(<ManualTotalForm {...baseProps} score={8} manual={false} />);
    expect(screen.getByText("Computed")).toBeInTheDocument();
    expect(screen.getByText("Current: 8 / 10")).toBeInTheDocument();
  });

  it("shows the Manual badge for a manual cell", () => {
    renderWithMantine(<ManualTotalForm {...baseProps} score={8} manual={true} />);
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("shows an em dash for a cell without a score", () => {
    renderWithMantine(<ManualTotalForm {...baseProps} score={null} manual={false} />);
    expect(screen.getByText("Current: — / 10")).toBeInTheDocument();
  });

  it("sets a manual total and notifies on success", async () => {
    const onSaved = vi.fn();

    renderWithMantine(
      <ManualTotalForm {...baseProps} score={8} manual={false} onSaved={onSaved} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Set total" }));

    expect(mockSetManualTotal).toHaveBeenCalledWith({
      assignment_id: 7,
      sid: "s1",
      score: 8,
      manual: true
    });
    expect(mockNotify.success).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it("sends the edited value rather than the original score", async () => {
    renderWithMantine(<ManualTotalForm {...baseProps} score={8} manual={false} />);
    const input = screen.getByLabelText("Manual total");

    await userEvent.clear(input);
    await userEvent.type(input, "42");
    await userEvent.click(screen.getByRole("button", { name: "Set total" }));

    expect(mockSetManualTotal).toHaveBeenCalledWith({
      assignment_id: 7,
      sid: "s1",
      score: 42,
      manual: true
    });
  });

  it("disables revert for a non-manual cell and reverts a manual cell", async () => {
    const { rerender } = renderWithMantine(
      <ManualTotalForm {...baseProps} score={8} manual={false} />
    );

    expect(screen.getByRole("button", { name: "Revert to computed" })).toBeDisabled();

    rerender(<ManualTotalForm {...baseProps} score={8} manual={true} />);
    await userEvent.click(screen.getByRole("button", { name: "Revert to computed" }));

    expect(mockSetManualTotal).toHaveBeenCalledWith({
      assignment_id: 7,
      sid: "s1",
      manual: false
    });
  });

  it("follows the score when a regrade moves it underneath the form", () => {
    const { rerender } = renderWithMantine(
      <ManualTotalForm {...baseProps} score={8} manual={false} />
    );

    expect(screen.getByLabelText("Manual total")).toHaveValue("8");
    rerender(<ManualTotalForm {...baseProps} score={3} manual={false} />);
    expect(screen.getByLabelText("Manual total")).toHaveValue("3");
  });

  it("notifies an error when the mutation rejects", async () => {
    mockSetManualTotal.mockReturnValue({ unwrap: () => Promise.reject(new Error("boom")) });
    renderWithMantine(<ManualTotalForm {...baseProps} score={8} manual={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Set total" }));

    expect(mockNotify.error).toHaveBeenCalled();
  });
});
