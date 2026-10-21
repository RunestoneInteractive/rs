import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateTimePicker } from "./DateTimePicker";

const openCalendar = () => {
  const input = screen.getByPlaceholderText("Select date and time");

  fireEvent.focus(input);
  fireEvent.click(input);
};

const getCalendarFocusables = (root: HTMLElement) =>
  Array.from(
    root.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )
  ).filter((element) => element.tabIndex >= 0);

describe("DateTimePicker", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("portals the calendar to #root by default", () => {
    const { container } = render(<DateTimePicker value={null} onChange={() => {}} />);

    openCalendar();

    expect(root.querySelector(".react-datepicker")).toBeTruthy();
    expect(container.querySelector(".react-datepicker")).toBeFalsy();
  });

  it("renders the calendar inline when withinPortal is false", () => {
    const { container } = render(
      <DateTimePicker value={null} onChange={() => {}} withinPortal={false} />
    );

    openCalendar();

    expect(container.querySelector(".react-datepicker")).toBeTruthy();
    expect(root.querySelector(".react-datepicker")).toBeFalsy();
  });

  it("forwards id to the input so external labels can associate via htmlFor", () => {
    render(<DateTimePicker value={null} onChange={() => {}} id="due-date" />);

    const input = screen.getByPlaceholderText("Select date and time");

    expect(input).toHaveAttribute("id", "due-date");
  });

  it("names the input from ariaLabel when no visible label exists", () => {
    render(<DateTimePicker value={null} onChange={() => {}} ariaLabel="Visible on date" />);

    expect(screen.getByRole("textbox", { name: "Visible on date" })).toBeInTheDocument();
  });

  it("closes the calendar when focus leaves the input and calendar", async () => {
    render(
      <>
        <DateTimePicker value={null} onChange={() => {}} />
        <button type="button">After picker</button>
      </>
    );

    openCalendar();
    expect(root.querySelector(".react-datepicker")).toBeInTheDocument();

    fireEvent.focus(screen.getByRole("button", { name: "After picker" }));

    await waitFor(() => expect(root.querySelector(".react-datepicker")).not.toBeInTheDocument());
  });

  it("closes the first calendar before opening another picker", async () => {
    render(
      <>
        <DateTimePicker value={null} onChange={() => {}} ariaLabel="First date" />
        <DateTimePicker value={null} onChange={() => {}} ariaLabel="Second date" />
      </>
    );

    const firstInput = screen.getByRole("textbox", { name: "First date" });
    const secondInput = screen.getByRole("textbox", { name: "Second date" });

    fireEvent.focus(firstInput);
    fireEvent.click(firstInput);
    expect(root.querySelectorAll(".react-datepicker")).toHaveLength(1);

    fireEvent.focus(secondInput);
    fireEvent.click(secondInput);

    await waitFor(() => expect(root.querySelectorAll(".react-datepicker")).toHaveLength(1));
    expect(secondInput).toHaveClass("react-datepicker-ignore-onclickoutside");
  });

  it("moves focus to the next form control after tabbing past the calendar", async () => {
    const user = userEvent.setup();

    render(
      <>
        <DateTimePicker value={null} onChange={() => {}} withinPortal={false} />
        <button type="button">After picker</button>
      </>
    );

    openCalendar();
    const calendar = document.querySelector<HTMLElement>(".react-datepicker");

    calendar
      ?.querySelectorAll<HTMLElement>(".react-datepicker__navigation")
      .forEach((button) => (button.tabIndex = -1));
    const calendarFocusables = getCalendarFocusables(calendar!);

    expect(calendar).toBeInTheDocument();
    expect(calendarFocusables.length).toBeGreaterThan(0);
    await user.tab();
    expect(calendar).toContainElement(document.activeElement as HTMLElement);
    for (
      let index = 0;
      index <= calendarFocusables.length && calendar?.contains(document.activeElement);
      index += 1
    ) {
      await user.tab();
    }

    await waitFor(() => {
      expect(document.querySelector(".react-datepicker")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "After picker" })).toHaveFocus();
    });
  });

  it("moves focus to the previous form control after shift-tabbing past the calendar", async () => {
    const user = userEvent.setup();

    render(
      <>
        <button type="button">Before picker</button>
        <DateTimePicker value={null} onChange={() => {}} withinPortal={false} />
      </>
    );

    openCalendar();
    const calendar = document.querySelector<HTMLElement>(".react-datepicker");

    calendar
      ?.querySelectorAll<HTMLElement>(".react-datepicker__navigation")
      .forEach((button) => (button.tabIndex = -1));
    const calendarFocusables = getCalendarFocusables(calendar!);
    const firstCalendarControl = calendarFocusables.at(0);

    expect(calendar).toBeInTheDocument();
    expect(firstCalendarControl).toBeDefined();
    await user.tab();
    expect(calendar).toContainElement(document.activeElement as HTMLElement);
    for (
      let index = 0;
      index <= calendarFocusables.length && document.activeElement !== firstCalendarControl;
      index += 1
    ) {
      await user.tab({ shift: true });
    }
    expect(firstCalendarControl).toHaveFocus();
    await user.tab({ shift: true });

    await waitFor(() => {
      expect(document.querySelector(".react-datepicker")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Before picker" })).toHaveFocus();
    });
  });
});
