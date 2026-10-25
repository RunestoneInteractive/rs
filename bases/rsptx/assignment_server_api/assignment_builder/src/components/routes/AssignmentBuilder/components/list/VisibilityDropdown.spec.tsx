import userEvent from "@testing-library/user-event";

import { fireEvent, renderWithMantine, screen, waitFor } from "@/test/renderWithMantine";
import { Assignment } from "@/types/assignment";

import { VisibilityDropdown } from "./VisibilityDropdown";

const assignment = {
  id: 1,
  name: "Scheduled assignment",
  visible: true,
  visible_on: null,
  hidden_on: null
} as Assignment;

describe("VisibilityDropdown", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("keeps the visibility menu open while selecting a date from the portaled calendar", async () => {
    const onChange = vi.fn();

    renderWithMantine(<VisibilityDropdown assignment={assignment} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Visible. Change visibility" }));
    fireEvent.click(screen.getByRole("radio", { name: "Hidden on…" }));
    fireEvent.click(screen.getByRole("textbox", { name: "Hidden on date" }));

    const calendar = root.querySelector(".react-datepicker");

    expect(calendar).toBeInTheDocument();

    const availableDay = calendar?.querySelector<HTMLElement>(
      ".react-datepicker__day:not(.react-datepicker__day--outside-month):not(.react-datepicker__day--selected)"
    );

    expect(availableDay).toBeTruthy();
    fireEvent.mouseDown(availableDay!);
    fireEvent.click(availableDay!);

    expect(screen.getByText("Visibility status")).toBeVisible();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("moves focus from a scheduled visibility option to its date field", async () => {
    const user = userEvent.setup();

    renderWithMantine(<VisibilityDropdown assignment={assignment} onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Visible. Change visibility" });

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("radio", { name: "Hidden" })).toHaveFocus();

    const hiddenOnOption = screen.getByRole("radio", { name: "Hidden on…" });

    await user.click(hiddenOnOption);
    hiddenOnOption.focus();
    await user.tab();

    const dateInput = screen.getByRole("textbox", { name: "Hidden on date" });

    expect(dateInput).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(root.querySelector(".react-datepicker")).toBeInTheDocument();
  });

  it("moves focus through both date fields for a visibility period", async () => {
    const user = userEvent.setup();

    renderWithMantine(<VisibilityDropdown assignment={assignment} onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Visible. Change visibility" });

    trigger.focus();
    await user.keyboard("{Enter}");

    const periodOption = screen.getByRole("radio", { name: "Visible during period" });

    await user.click(periodOption);
    periodOption.focus();
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Visible from date" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("textbox", { name: "Hidden after date" })).toHaveFocus();
  });

  it("closes the visibility menu with Escape and returns focus to its trigger", async () => {
    const user = userEvent.setup();

    renderWithMantine(<VisibilityDropdown assignment={assignment} onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Visible. Change visibility" });

    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText("Visibility status")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
