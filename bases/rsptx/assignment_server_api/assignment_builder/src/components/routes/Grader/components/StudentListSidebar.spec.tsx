import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { renderWithMantine, screen, within } from "@/test/renderWithMantine";
import type { GraderStudentAnswer } from "@store/grader/grader.logic.api";

import { StudentListSidebar } from "./StudentListSidebar";

const makeAnswer = (overrides: Partial<GraderStudentAnswer> = {}): GraderStudentAnswer => ({
  sid: "s1",
  answer: "",
  attempts: 1,
  score: null,
  comment: null,
  max_points: 10,
  ...overrides
});

const manualQuestion = { autograde: "manual" };

const renderSidebar = (props: Partial<React.ComponentProps<typeof StudentListSidebar>> = {}) => {
  const onSelect = vi.fn();
  const onToggleHideGraded = vi.fn();
  const answers = props.answers ?? [
    makeAnswer({ sid: "s1", first_name: "Ada", last_name: "Lovelace", score: 5, comment: "ok" }),
    makeAnswer({ sid: "s2", first_name: "Bob", last_name: "Stone" }),
    makeAnswer({ sid: "s3", attempts: 0, score: null })
  ];
  renderWithMantine(
    <StudentListSidebar
      answers={answers}
      question={manualQuestion}
      onSelect={onSelect}
      hideGraded={false}
      onToggleHideGraded={onToggleHideGraded}
      {...props}
    />
  );
  return { onSelect, onToggleHideGraded };
};

describe("StudentListSidebar", () => {
  it("shows the graded-over-total counter", () => {
    renderSidebar();

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("renders one row per student and falls back to the sid when no name is set", () => {
    renderSidebar();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(options[2]).getAllByText("s3").length).toBeGreaterThanOrEqual(1);
  });

  it("filters the list by name and shows an empty note when nothing matches", async () => {
    renderSidebar();
    const filter = screen.getByPlaceholderText("Filter…");

    await userEvent.type(filter, "Ada");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();

    await userEvent.clear(filter);
    await userEvent.type(filter, "nobody");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No students match the filter.")).toBeInTheDocument();
  });

  it("calls onSelect when a row is clicked", async () => {
    const { onSelect } = renderSidebar();

    await userEvent.click(screen.getByText("Ada Lovelace"));
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("calls onSelect when Enter is pressed on a focused row", async () => {
    const { onSelect } = renderSidebar();
    const options = screen.getAllByRole("option");

    options[1].focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("s2");
  });

  it("toggles the hide-graded control and reports the new value", async () => {
    const { onToggleHideGraded } = renderSidebar();
    const toggle = screen.getByRole("button", { name: "Hide already-graded students" });

    expect(toggle).toHaveTextContent("All students");
    await userEvent.click(toggle);
    expect(onToggleHideGraded).toHaveBeenCalledWith(true);
  });

  it("hides graded students and relabels the toggle when hideGraded is on", () => {
    renderSidebar({ hideGraded: true });

    expect(screen.getByRole("button", { name: "Hide already-graded students" })).toHaveTextContent(
      "Hide graded"
    );
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(screen.getByText("Bob Stone")).toBeInTheDocument();
  });

  it("marks the active student row as selected", () => {
    renderSidebar({ activeSid: "s2" });

    const selected = screen.getByRole("option", { selected: true });
    expect(within(selected).getByText("Bob Stone")).toBeInTheDocument();
  });

  it("labels each status dot with its accessible status name", () => {
    renderSidebar();

    expect(screen.getByLabelText("Graded")).toBeInTheDocument();
    expect(screen.getByLabelText("Pending")).toBeInTheDocument();
    expect(screen.getByLabelText("No submission")).toBeInTheDocument();
  });
});
