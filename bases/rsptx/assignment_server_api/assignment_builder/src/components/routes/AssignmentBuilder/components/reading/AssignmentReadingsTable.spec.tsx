import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { Exercise } from "@/types/exercises";

import { AssignmentReadingsTable } from "./AssignmentReadingsTable";

const { mockReorder } = vi.hoisted(() => ({ mockReorder: vi.fn() }));

vi.mock("@store/assignmentExercise/assignmentExercise.logic.api", () => ({
  useReorderAssignmentExercisesMutation: () => [mockReorder]
}));

vi.mock("./components/EditAllReadings/EditInputValueHeaderReadings", () => ({
  EditInputValueHeaderReadings: ({ label }: { label: string }) => <span>{label}</span>
}));

vi.mock("@components/ui/EditableTable/EditableCellFactory", () => ({
  EditableCellFactory: ({ value }: { value: number }) => <span>{value}</span>
}));

vi.mock("./components/ActivitiesRequiredCell", () => ({
  ActivitiesRequiredCell: ({ value }: { value: number }) => <span>{value}</span>
}));

vi.mock("@components/ui/EditableTable/TableOverlay", () => ({
  TableSelectionOverlay: () => null
}));

const READINGS: Exercise[] = [
  {
    id: 1,
    name: "Welcome",
    title: "Welcome",
    chapter: "Intro",
    subchapter: "intro-welcome",
    numQuestions: 10,
    activities_required: 6,
    points: 5,
    question_type: "page"
  },
  {
    id: 2,
    name: "Variables",
    title: "Variables",
    chapter: "Basics",
    subchapter: "basics-variables",
    numQuestions: 0,
    activities_required: 0,
    points: 3,
    question_type: "page"
  }
] as unknown as Exercise[];

const baseProps = {
  assignmentReadings: READINGS,
  selectedReadings: [] as Exercise[],
  setSelectedReadings: vi.fn(),
  globalFilter: "",
  startItemId: null,
  draggingFieldName: null,
  handleMouseDown: vi.fn(),
  handleMouseUp: vi.fn(),
  handleChange: vi.fn()
};

describe("AssignmentReadingsTable", () => {
  it("renders one row per reading with chapter and section", () => {
    renderWithMantine(<AssignmentReadingsTable {...baseProps} />);
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Basics")).toBeInTheDocument();
    expect(screen.getByText("Variables")).toBeInTheDocument();
  });

  it("filters readings by chapter or section text", () => {
    renderWithMantine(<AssignmentReadingsTable {...baseProps} globalFilter="basics" />);
    expect(screen.queryByText("Welcome")).not.toBeInTheDocument();
    expect(screen.getByText("Variables")).toBeInTheDocument();
  });

  it("defaults the activity count to at least one and required to 80 percent", () => {
    renderWithMantine(
      <AssignmentReadingsTable {...baseProps} assignmentReadings={[READINGS[1]]} />
    );
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("right-aligns the numeric columns", () => {
    const { container } = renderWithMantine(<AssignmentReadingsTable {...baseProps} />);

    const headers = Array.from(container.querySelectorAll("thead th"));
    const activitiesHeader = headers.find((th) => th.textContent === "Activities");
    const requiredHeader = headers.find((th) => th.textContent === "Required");
    const pointsHeader = headers.find((th) => th.textContent === "Points");

    expect(activitiesHeader).toHaveStyle({ textAlign: "right" });
    expect(requiredHeader).toHaveStyle({ textAlign: "right" });
    expect(pointsHeader).toHaveStyle({ textAlign: "right" });
  });

  it("shows the getting-started empty state when there are no readings", () => {
    renderWithMantine(<AssignmentReadingsTable {...baseProps} assignmentReadings={[]} />);
    expect(screen.getByText("No readings yet")).toBeInTheDocument();
    expect(screen.getByText(/Choose readings/)).toBeInTheDocument();
  });

  it("shows the no-match empty state when the filter excludes everything", () => {
    renderWithMantine(<AssignmentReadingsTable {...baseProps} globalFilter="zzz" />);
    expect(screen.getByText("No readings match your search")).toBeInTheDocument();
    expect(screen.getByText("Try a different search term.")).toBeInTheDocument();
  });
});
