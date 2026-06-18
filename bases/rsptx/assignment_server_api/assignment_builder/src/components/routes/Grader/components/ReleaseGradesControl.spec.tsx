import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";
import type { Assignment } from "@/types/assignment";

import { ReleaseGradesControl } from "./ReleaseGradesControl";

const { mockOpenConfirmModal, mockUseGetAssignmentsQuery, mockSetReleased, mockNotify } =
  vi.hoisted(() => ({
    mockOpenConfirmModal: vi.fn(),
    mockUseGetAssignmentsQuery: vi.fn(),
    mockSetReleased: vi.fn(),
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
  useSetAssignmentReleasedMutation: () => [mockSetReleased, { isLoading: false }]
}));

vi.mock("@/components/ui/notify", () => ({ notify: mockNotify }));

const makeAssignment = (over: Partial<Assignment>): Assignment =>
  ({ id: 42, name: "Quiz 1", released: false, ...over }) as unknown as Assignment;

const setAssignments = (assignments: Assignment[] | undefined) =>
  mockUseGetAssignmentsQuery.mockReturnValue({ data: assignments });

beforeEach(() => {
  vi.clearAllMocks();
  mockSetReleased.mockReturnValue({ unwrap: () => Promise.resolve({}) });
});

describe("ReleaseGradesControl", () => {
  it("renders nothing when the assignment is not in the list", () => {
    setAssignments([]);
    renderWithMantine(<ReleaseGradesControl assignmentId={42} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows a hidden, unchecked switch when grades are not released", () => {
    setAssignments([makeAssignment({ released: false })]);
    renderWithMantine(<ReleaseGradesControl assignmentId={42} />);
    expect(screen.getByText("Grades hidden")).toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("shows a released, checked switch when grades are released", () => {
    setAssignments([makeAssignment({ released: true })]);
    renderWithMantine(<ReleaseGradesControl assignmentId={42} />);
    expect(screen.getByText("Grades released")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("opens a release confirmation and releases on confirm", async () => {
    setAssignments([makeAssignment({ released: false })]);
    renderWithMantine(<ReleaseGradesControl assignmentId={42} />);

    await userEvent.click(screen.getByRole("switch"));

    expect(mockOpenConfirmModal).toHaveBeenCalledTimes(1);
    const config = mockOpenConfirmModal.mock.calls[0][0];
    expect(config.title).toBe("Release grades");
    expect(config.labels.confirm).toBe("Release");

    await config.onConfirm();

    expect(mockSetReleased).toHaveBeenCalledWith({ assignment_id: 42, released: true });
    expect(mockNotify.success).toHaveBeenCalled();
  });

  it("opens a destructive hide confirmation when turning release off", async () => {
    setAssignments([makeAssignment({ released: true })]);
    renderWithMantine(<ReleaseGradesControl assignmentId={42} />);

    await userEvent.click(screen.getByRole("switch"));

    const config = mockOpenConfirmModal.mock.calls[0][0];
    expect(config.title).toBe("Hide grades");
    expect(config.confirmProps).toEqual({ color: "red" });

    await config.onConfirm();

    expect(mockSetReleased).toHaveBeenCalledWith({ assignment_id: 42, released: false });
  });

  it("notifies an error when the mutation rejects", async () => {
    setAssignments([makeAssignment({ released: false })]);
    mockSetReleased.mockReturnValue({ unwrap: () => Promise.reject(new Error("boom")) });
    renderWithMantine(<ReleaseGradesControl assignmentId={42} />);

    await userEvent.click(screen.getByRole("switch"));
    await mockOpenConfirmModal.mock.calls[0][0].onConfirm();

    expect(mockNotify.error).toHaveBeenCalled();
  });
});
