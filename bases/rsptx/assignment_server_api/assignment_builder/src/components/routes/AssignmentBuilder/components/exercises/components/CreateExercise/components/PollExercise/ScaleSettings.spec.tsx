import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { ScaleSettings } from "./ScaleSettings";

describe("ScaleSettings", () => {
  it("renders the current scale value in the input", () => {
    renderWithMantine(<ScaleSettings value={5} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Maximum scale value")).toHaveValue("5");
  });

  it("marks the matching preset as active", () => {
    renderWithMantine(<ScaleSettings value={7} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "1-7", pressed: true })).toBeInTheDocument();
  });

  it("calls onChange with the preset value when a preset is clicked", () => {
    const onChange = vi.fn();

    renderWithMantine(<ScaleSettings value={5} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "1-10" }));

    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("calls onChange when the number input is edited", () => {
    const onChange = vi.fn();

    renderWithMantine(<ScaleSettings value={5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Maximum scale value"), { target: { value: "8" } });

    expect(onChange).toHaveBeenCalledWith(8);
  });
});
