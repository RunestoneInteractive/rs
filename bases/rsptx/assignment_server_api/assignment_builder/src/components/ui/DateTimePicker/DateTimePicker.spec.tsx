import { fireEvent, render, screen } from "@testing-library/react";

import { DateTimePicker } from "./DateTimePicker";

const openCalendar = () => {
  const input = screen.getByPlaceholderText("Select date and time");

  fireEvent.focus(input);
  fireEvent.click(input);
};

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
});
