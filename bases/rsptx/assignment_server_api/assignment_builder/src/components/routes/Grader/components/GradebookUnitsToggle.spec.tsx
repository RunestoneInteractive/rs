import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { GradebookUnitsToggle } from "./GradebookUnitsToggle";

const { mockSetUnits, mockNotify } = vi.hoisted(() => ({
  mockSetUnits: vi.fn(),
  mockNotify: { success: vi.fn(), error: vi.fn() }
}));

vi.mock("@store/grader/grader.logic.api", () => ({
  useSetGradebookUnitsMutation: () => [mockSetUnits, { isLoading: false }]
}));

vi.mock("@/components/ui/notify", () => ({ notify: mockNotify }));

beforeEach(() => {
  vi.clearAllMocks();
  mockSetUnits.mockReturnValue({ unwrap: () => Promise.resolve({ show_points: true }) });
});

describe("GradebookUnitsToggle", () => {
  it("shows which units the course is using", () => {
    renderWithMantine(<GradebookUnitsToggle showPoints={false} />);

    expect(screen.getByRole("radio", { name: "%" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Points" })).not.toBeChecked();
  });

  it("switches the course to points", async () => {
    renderWithMantine(<GradebookUnitsToggle showPoints={false} />);

    await userEvent.click(screen.getByRole("radio", { name: "Points" }));

    expect(mockSetUnits).toHaveBeenCalledWith({ show_points: true });
    expect(mockNotify.success).toHaveBeenCalledWith("Gradebook now shows points");
  });

  it("switches the course back to percentages", async () => {
    renderWithMantine(<GradebookUnitsToggle showPoints={true} />);

    await userEvent.click(screen.getByRole("radio", { name: "%" }));

    expect(mockSetUnits).toHaveBeenCalledWith({ show_points: false });
    expect(mockNotify.success).toHaveBeenCalledWith("Gradebook now shows percentages");
  });

  it("does not rewrite the setting when the current units are picked again", async () => {
    renderWithMantine(<GradebookUnitsToggle showPoints={true} />);

    await userEvent.click(screen.getByRole("radio", { name: "Points" }));

    expect(mockSetUnits).not.toHaveBeenCalled();
  });

  it("tells the reader when the change did not stick", async () => {
    mockSetUnits.mockReturnValue({ unwrap: () => Promise.reject(new Error("nope")) });
    renderWithMantine(<GradebookUnitsToggle showPoints={false} />);

    await userEvent.click(screen.getByRole("radio", { name: "Points" }));

    expect(mockNotify.error).toHaveBeenCalledWith(
      "Couldn't change the gradebook units. Try again."
    );
  });
});
