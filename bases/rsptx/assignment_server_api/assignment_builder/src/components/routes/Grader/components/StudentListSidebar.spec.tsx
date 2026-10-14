import type { GraderStudentAnswer } from "@store/grader/grader.logic.api";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { renderWithMantine, screen, within } from "@/test/renderWithMantine";

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
  const onToggleHideFullCredit = vi.fn();
  const onToggleHideUnanswered = vi.fn();
  const answers = props.answers ?? [
    makeAnswer({ sid: "s1", first_name: "Ada", last_name: "Lovelace", score: 10, comment: "ok" }),
    makeAnswer({ sid: "s2", first_name: "Bob", last_name: "Stone" }),
    makeAnswer({ sid: "s3", attempts: 0, score: null })
  ];

  renderWithMantine(
    <StudentListSidebar
      answers={answers}
      question={manualQuestion}
      onSelect={onSelect}
      hideFullCredit={false}
      onToggleHideFullCredit={onToggleHideFullCredit}
      hideUnanswered={false}
      onToggleHideUnanswered={onToggleHideUnanswered}
      {...props}
    />
  );
  return { onSelect, onToggleHideFullCredit, onToggleHideUnanswered };
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
    const filter = screen.getByPlaceholderText("Search students…");

    await userEvent.type(filter, "Ada");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();

    await userEvent.clear(filter);
    await userEvent.type(filter, "nobody");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No students match the filter.")).toBeInTheDocument();
  });

  it("announces filtered result counts and exposes keyboard instructions", async () => {
    renderSidebar();
    const filter = screen.getByRole("textbox", { name: "Search students" });
    const listbox = screen.getByRole("listbox", { name: "Students" });
    const instructionsId = listbox.getAttribute("aria-describedby");

    expect(screen.getByTestId("student-filter-status")).toHaveTextContent("3 of 3 students shown.");
    expect(instructionsId).toBeTruthy();
    expect(document.getElementById(instructionsId!)).toHaveTextContent(/Up and Down Arrow keys/);

    await userEvent.type(filter, "Ada");

    expect(screen.getByTestId("student-filter-status")).toHaveTextContent("1 of 3 students shown.");
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

  it("keeps only the active option in the Tab order", () => {
    renderSidebar({ activeSid: "s2" });
    const options = screen.getAllByRole("option");

    expect(options[0]).toHaveAttribute("tabindex", "-1");
    expect(options[1]).toHaveAttribute("tabindex", "0");
    expect(options[2]).toHaveAttribute("tabindex", "-1");
  });

  it("uses the first visible option as the Tab stop when the active student is filtered out", () => {
    renderSidebar({ activeSid: "missing" });
    const options = screen.getAllByRole("option");

    expect(options[0]).toHaveAttribute("tabindex", "0");
    expect(options[1]).toHaveAttribute("tabindex", "-1");
  });

  it("moves and selects with ArrowDown", async () => {
    const { onSelect } = renderSidebar({ activeSid: "s1" });
    const options = screen.getAllByRole("option");

    options[0].focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(options[1]).toHaveFocus();
    expect(onSelect).toHaveBeenCalledWith("s2");
  });

  it("supports Home and End navigation", async () => {
    const { onSelect } = renderSidebar({ activeSid: "s2" });
    const options = screen.getAllByRole("option");

    options[1].focus();
    await userEvent.keyboard("{End}");
    expect(options[2]).toHaveFocus();
    expect(onSelect).toHaveBeenLastCalledWith("s3");

    await userEvent.keyboard("{Home}");
    expect(options[0]).toHaveFocus();
    expect(onSelect).toHaveBeenLastCalledWith("s1");
  });

  it("reports changes to both student filters", async () => {
    const { onToggleHideFullCredit, onToggleHideUnanswered } = renderSidebar();

    await userEvent.click(screen.getByRole("button", { name: "Student filters, 0 active" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Hide students with full credit" }));
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Hide students with no submission" })
    );

    expect(onToggleHideFullCredit).toHaveBeenCalledWith(true);
    expect(onToggleHideUnanswered).toHaveBeenCalledWith(true);
  });

  it("closes student filters with Escape and returns focus to the trigger", async () => {
    renderSidebar();
    const trigger = screen.getByRole("button", { name: "Student filters, 0 active" });

    await userEvent.click(trigger);
    const checkbox = screen.getByRole("checkbox", { name: "Hide students with full credit" });

    checkbox.focus();
    await userEvent.keyboard("{Escape}");

    expect(
      screen.queryByRole("checkbox", { name: "Hide students with full credit" })
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows the number of active filters on the trigger", () => {
    renderSidebar({ hideFullCredit: true, hideUnanswered: true });

    expect(screen.getByRole("button", { name: "Student filters, 2 active" })).toHaveTextContent(
      "Filters (2)"
    );
  });

  it("hides only students with full credit when that filter is on", () => {
    renderSidebar({ hideFullCredit: true });

    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(screen.getByText("Bob Stone")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("keeps partially credited students visible when full-credit students are hidden", () => {
    renderSidebar({
      hideFullCredit: true,
      answers: [
        makeAnswer({ sid: "partial", first_name: "Partial", score: 5 }),
        makeAnswer({ sid: "full", first_name: "Full", score: 10 })
      ]
    });

    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(screen.queryByText("Full")).not.toBeInTheDocument();
  });

  it("hides students with no submission when that filter is on", () => {
    renderSidebar({ hideUnanswered: true });

    expect(screen.queryByText("s3")).not.toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("combines the full-credit and no-submission filters", () => {
    renderSidebar({ hideFullCredit: true, hideUnanswered: true });

    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(screen.queryByText("s3")).not.toBeInTheDocument();
    expect(screen.getByText("Bob Stone")).toBeInTheDocument();
  });

  it("marks the active student row as selected", () => {
    renderSidebar({ activeSid: "s2" });

    const selected = screen.getByRole("option", { selected: true });

    expect(within(selected).getByText("Bob Stone")).toBeInTheDocument();
  });

  it("highlights students who submitted work after the deadline", () => {
    renderSidebar({
      assignmentDueDate: "2020-01-01T00:00:00",
      courseTimezone: "UTC",
      deadlineEnforced: true,
      lateStudentsBySid: new Map([
        [
          "s2",
          {
            username: "s2",
            name: "Bob Stone",
            extension_days: 0,
            effective_due_date: "2020-01-01T00:00:00",
            first_late_activity_at: "2020-06-01T00:00:00"
          }
        ]
      ])
    });

    const lateRow = screen.getByRole("option", { name: /Bob Stone.*Late/i });
    const onTimeRow = screen.getByRole("option", { name: /Ada Lovelace/i });
    const lateBadge = within(lateRow).getByText("Late");

    expect(lateRow).toHaveClass(/late/);
    expect(screen.getByText(/Deadline:/)).toHaveTextContent(/2020/);
    expect(lateBadge).toHaveAttribute("title", expect.stringContaining("Effective deadline:"));
    expect(lateBadge).toHaveAttribute(
      "title",
      expect.stringContaining("First activity after deadline:")
    );
    expect(onTimeRow).not.toHaveClass(/late/);
  });

  it("labels each status dot with its accessible status name", () => {
    renderSidebar();

    expect(screen.getByLabelText("Graded")).toBeInTheDocument();
    expect(screen.getByLabelText("Pending")).toBeInTheDocument();
    expect(screen.getByLabelText("No submission")).toBeInTheDocument();
  });
});
