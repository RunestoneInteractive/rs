import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";
import type { Assignment } from "@/types/assignment";

import { ThresholdControl } from "./ThresholdControl";

const { mockOpenConfirmModal, mockUseGetAssignmentsQuery, mockSetThreshold, mockNotify } =
  vi.hoisted(() => ({
    mockOpenConfirmModal: vi.fn(),
    mockUseGetAssignmentsQuery: vi.fn(),
    mockSetThreshold: vi.fn(),
    mockNotify: { success: vi.fn(), error: vi.fn() }
  }));

vi.mock("@mantine/modals", async (importOriginal) => {
  const original = await importOriginal<typeof import("@mantine/modals")>();
  return { ...original, modals: { ...original.modals, openConfirmModal: mockOpenConfirmModal } };
});

vi.mock("@store/assignment/assignment.logic.api", () => ({
  useGetAssignmentsQuery: mockUseGetAssignmentsQuery
}));

vi.mock("@store/grader/grader.logic.api", () => ({
  useSetAssignmentThresholdMutation: () => [mockSetThreshold, { isLoading: false }]
}));

vi.mock("@/components/ui/notify", () => ({ notify: mockNotify }));

const makeAssignment = (over: Partial<Assignment>): Assignment =>
  ({ id: 42, name: "Quiz 1", threshold_pct: null, ...over }) as unknown as Assignment;

const setAssignments = (assignments: Assignment[] | undefined) =>
  mockUseGetAssignmentsQuery.mockReturnValue({ data: assignments });

const openPopover = async () => userEvent.click(screen.getByRole("button", { name: /Threshold/ }));

beforeEach(() => {
  vi.clearAllMocks();
  mockSetThreshold.mockReturnValue({ unwrap: () => Promise.resolve({}) });
});

describe("ThresholdControl", () => {
  it("renders nothing when the assignment is not in the list", () => {
    setAssignments([]);
    renderWithMantine(<ThresholdControl assignmentId={42} />);
    expect(screen.queryByRole("button", { name: /Threshold/ })).not.toBeInTheDocument();
  });

  it("shows a bare Threshold label when no threshold is set", () => {
    setAssignments([makeAssignment({ threshold_pct: null })]);
    renderWithMantine(<ThresholdControl assignmentId={42} />);
    expect(screen.getByRole("button", { name: /Threshold/ })).toHaveTextContent("Threshold");
  });

  it("shows the current percentage when a threshold is set", () => {
    setAssignments([makeAssignment({ threshold_pct: 0.9 })]);
    renderWithMantine(<ThresholdControl assignmentId={42} />);
    expect(screen.getByRole("button", { name: /Threshold/ })).toHaveTextContent("Threshold 90%");
  });

  it("opens a confirmation and sets the threshold as a fraction on confirm", async () => {
    setAssignments([makeAssignment({ threshold_pct: null })]);
    renderWithMantine(<ThresholdControl assignmentId={42} />);

    await openPopover();
    await userEvent.type(screen.getByLabelText("Threshold percentage"), "80");
    await userEvent.click(screen.getByRole("button", { name: "Set threshold" }));

    expect(mockOpenConfirmModal).toHaveBeenCalledTimes(1);
    const config = mockOpenConfirmModal.mock.calls[0][0];
    expect(config.title).toBe("Set threshold scoring");

    await config.onConfirm();

    expect(mockSetThreshold).toHaveBeenCalledWith({ assignment_id: 42, threshold_pct: 0.8 });
    expect(mockNotify.success).toHaveBeenCalled();
  });

  it("clears the threshold without a confirmation", async () => {
    setAssignments([makeAssignment({ threshold_pct: 0.9 })]);
    renderWithMantine(<ThresholdControl assignmentId={42} />);

    await openPopover();
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(mockSetThreshold).toHaveBeenCalledWith({ assignment_id: 42, threshold_pct: null });
    expect(mockNotify.success).toHaveBeenCalled();
  });

  it("rejects an out-of-range percentage without calling the mutation", async () => {
    setAssignments([makeAssignment({ threshold_pct: null })]);
    renderWithMantine(<ThresholdControl assignmentId={42} />);

    await openPopover();
    await userEvent.type(screen.getByLabelText("Threshold percentage"), "150");
    await userEvent.click(screen.getByRole("button", { name: "Set threshold" }));

    expect(mockOpenConfirmModal).not.toHaveBeenCalled();
    expect(mockSetThreshold).not.toHaveBeenCalled();
    expect(mockNotify.error).toHaveBeenCalled();
  });

  it("notifies an error when the mutation rejects", async () => {
    setAssignments([makeAssignment({ threshold_pct: 0.9 })]);
    mockSetThreshold.mockReturnValue({ unwrap: () => Promise.reject(new Error("boom")) });
    renderWithMantine(<ThresholdControl assignmentId={42} />);

    await openPopover();
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(mockNotify.error).toHaveBeenCalled();
  });
});
