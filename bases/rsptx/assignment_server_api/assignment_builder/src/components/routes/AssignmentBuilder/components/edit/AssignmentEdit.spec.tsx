import { useForm } from "react-hook-form";
import { vi } from "vitest";

import { fireEvent, renderWithMantine, screen } from "@/test/renderWithMantine";
import { Assignment, KindOfAssignment } from "@/types/assignment";

import { AssignmentEdit } from "./AssignmentEdit";

const exercisesSelectorMock = vi.fn(() => ({
  isExercisesError: false,
  isExercisesLoading: false
}));

vi.mock("@/hooks/useExercisesSelector", () => ({
  useExercisesSelector: () => exercisesSelectorMock()
}));

vi.mock("../reading/AssignmentReadings", () => ({
  AssignmentReadings: () => <div data-testid="readings-tab" />
}));

vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/AssignmentExercisesList",
  () => ({
    AssignmentExercises: () => <div data-testid="exercises-tab" />
  })
);

interface HarnessProps {
  kind?: KindOfAssignment;
  isCollapsed?: boolean;
  activeTab?: "basic" | "readings" | "exercises";
  onTabChange?: (tab: "basic" | "readings" | "exercises") => void;
  onCollapse?: () => void;
  onBack?: () => void;
}

const makeAssignment = (kind: KindOfAssignment): Assignment =>
  ({
    id: 7,
    name: "Homework 3",
    description: "",
    duedate: "2026-06-20T10:00:00",
    points: 12,
    kind,
    time_limit: null,
    nofeedback: true,
    nopause: true,
    peer_async_visible: false,
    visible: true,
    visible_on: null,
    hidden_on: null,
    enforce_due: false
  }) as Assignment;

const Harness = ({
  kind = "Regular",
  isCollapsed = false,
  activeTab = "basic",
  onTabChange = vi.fn(),
  onCollapse = vi.fn(),
  onBack = vi.fn()
}: HarnessProps) => {
  const assignment = makeAssignment(kind);
  const { control, watch, setValue } = useForm<Assignment>({ defaultValues: assignment });

  return (
    <AssignmentEdit
      control={control}
      selectedAssignment={assignment}
      isCollapsed={isCollapsed}
      activeTab={activeTab}
      onCollapse={onCollapse}
      onBack={onBack}
      onTabChange={onTabChange}
      onTypeSelect={vi.fn()}
      watch={watch as (name: string) => unknown}
      setValue={setValue}
    />
  );
};

describe("AssignmentEdit", () => {
  beforeEach(() => {
    exercisesSelectorMock.mockReturnValue({
      isExercisesError: false,
      isExercisesLoading: false
    });
  });

  it("renders the assignment name and the section papers for a Regular assignment", () => {
    renderWithMantine(<Harness kind="Regular" />);

    expect(screen.getByRole("heading", { name: "Homework 3" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scoring" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Visibility" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Behavior" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Peer settings" })).not.toBeInTheDocument();
  });

  it("shows the Behavior section and time limit only for Timed assignments", () => {
    renderWithMantine(<Harness kind="Timed" />);

    expect(screen.getByRole("heading", { name: "Behavior" })).toBeInTheDocument();
    expect(screen.getByText("Time limit")).toBeInTheDocument();
    expect(screen.getByText("Allow pause")).toBeInTheDocument();
    expect(screen.getByText("Allow feedback")).toBeInTheDocument();
  });

  it("shows the Peer settings section only for Peer assignments", () => {
    renderWithMantine(<Harness kind="Peer" />);

    expect(screen.getByRole("heading", { name: "Peer settings" })).toBeInTheDocument();
    expect(screen.getByText("Show async peer")).toBeInTheDocument();
  });

  it("marks the active rail item and calls onTabChange when another item is clicked", () => {
    const onTabChange = vi.fn();

    renderWithMantine(<Harness activeTab="basic" onTabChange={onTabChange} />);

    expect(screen.getByRole("button", { name: /Basic info/ })).toHaveAttribute(
      "aria-current",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: /Readings/ }));

    expect(onTabChange).toHaveBeenCalledWith("readings");
  });

  it("hides rail labels when collapsed and keeps icon buttons clickable", () => {
    const onTabChange = vi.fn();

    renderWithMantine(<Harness isCollapsed onTabChange={onTabChange} />);

    expect(screen.queryByText("Basic info")).not.toBeInTheDocument();
    expect(screen.queryByText("Assignment editor")).not.toBeInTheDocument();

    const railButtons = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-current") === "true");

    fireEvent.click(railButtons[0]);

    expect(onTabChange).toHaveBeenCalledWith("basic");
  });

  it("renders the readings tab content when activeTab is readings", () => {
    renderWithMantine(<Harness activeTab="readings" />);

    expect(screen.getByTestId("readings-tab")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Details" })).not.toBeInTheDocument();
  });

  it("renders an error panel when exercises fail to load", () => {
    exercisesSelectorMock.mockReturnValue({
      isExercisesError: true,
      isExercisesLoading: false
    });

    renderWithMantine(<Harness />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Couldn't load this assignment" })
    ).toBeInTheDocument();
  });
});
