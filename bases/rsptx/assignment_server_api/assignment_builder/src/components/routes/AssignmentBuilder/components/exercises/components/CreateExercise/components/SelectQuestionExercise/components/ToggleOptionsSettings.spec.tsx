import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { ToggleOptionsSettings } from "./ToggleOptionsSettings";

vi.mock("./ToggleOptionsSettings.module.css", () => ({ default: {} }));

describe("ToggleOptionsSettings", () => {
  it("selects 'Single question' when no toggle options are set", () => {
    renderWithMantine(<ToggleOptionsSettings toggleOptions={[]} onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /Single question/ })).toBeChecked();
  });

  it("selects 'Switch with lock' when both toggle and lock are set", () => {
    renderWithMantine(
      <ToggleOptionsSettings toggleOptions={["toggle", "lock"]} onChange={vi.fn()} />
    );

    expect(screen.getByRole("radio", { name: /Switch with lock/ })).toBeChecked();
  });

  it("emits ['toggle'] when 'Allow question switching' is chosen", () => {
    const onChange = vi.fn();

    renderWithMantine(<ToggleOptionsSettings toggleOptions={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Allow question switching/ }));

    expect(onChange).toHaveBeenCalledWith(["toggle"]);
  });

  it("emits ['toggle', 'lock'] when 'Switch with lock' is chosen", () => {
    const onChange = vi.fn();

    renderWithMantine(<ToggleOptionsSettings toggleOptions={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Switch with lock/ }));

    expect(onChange).toHaveBeenCalledWith(["toggle", "lock"]);
  });

  it("emits [] when 'Single question' is chosen", () => {
    const onChange = vi.fn();

    renderWithMantine(<ToggleOptionsSettings toggleOptions={["toggle"]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Single question/ }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
