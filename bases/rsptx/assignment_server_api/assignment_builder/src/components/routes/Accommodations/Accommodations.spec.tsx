import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { Accommodations } from "./Accommodations";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(() => ({ unwrap: () => Promise.resolve() })),
  remove: vi.fn(() => ({ unwrap: () => Promise.resolve() })),
  success: vi.fn(),
  error: vi.fn()
}));

vi.mock("@store/assignment/assignment.logic.api", () => ({
  useGetAssignmentsQuery: () => ({
    data: [{ id: 42, name: "Chapter quiz" }],
    isLoading: false
  })
}));

vi.mock("@store/grader/grader.logic.api", () => ({
  useGetAccommodationsQuery: () => ({
    data: {
      accommodations: [
        {
          row_id: 7,
          course_id: 1,
          sid: "student1",
          assignment_id: "Chapter quiz",
          duedate: 2,
          time_limit: 1.5,
          visible: true,
          allowLink: false
        }
      ]
    },
    isLoading: false,
    isError: false
  }),
  useUpsertAccommodationMutation: () => [mocks.upsert, { isLoading: false }],
  useDeleteAccommodationMutation: () => [mocks.remove, { isLoading: false }]
}));

vi.mock("@/components/ui/notify", () => ({
  notify: { success: mocks.success, error: mocks.error }
}));

vi.mock("@/components/routes/Grader/components/StudentMultiSelect", () => ({
  StudentMultiSelect: ({ onChange }: { onChange: (sids: string[]) => void }) => (
    <button type="button" onClick={() => onChange(["student1"])}>
      Select student
    </button>
  )
}));

describe("Accommodations", () => {
  const renderPage = () =>
    render(
      <MantineProvider>
        <Accommodations />
      </MantineProvider>
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves an all-assignment accommodation through the unified API", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Select student" }));
    fireEvent.click(screen.getByRole("button", { name: "Save accommodation" }));

    await waitFor(() => {
      expect(mocks.upsert).toHaveBeenCalledWith({
        sids: ["student1"],
        assignment_id: null,
        duedate: 0,
        time_limit: 1,
        visible: false,
        allowLink: false
      });
    });
    expect(mocks.success).toHaveBeenCalledWith("Accommodation saved");
  });

  it("shows and deletes existing accommodations", async () => {
    renderPage();

    expect(screen.getByRole("cell", { name: "Chapter quiz" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "student1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete accommodation for student1" }));

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(7));
    expect(mocks.success).toHaveBeenCalledWith("Accommodation deleted");
  });
});
