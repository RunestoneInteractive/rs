import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { ABExperimentSettings } from "./ABExperimentSettings";

describe("ABExperimentSettings", () => {
  it("renders the current experiment name", () => {
    renderWithMantine(<ABExperimentSettings experimentName="exp-1" onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText("Experiment name (optional)")).toHaveValue("exp-1");
  });

  it("calls onChange when the experiment name is edited", () => {
    const onChange = vi.fn();

    renderWithMantine(<ABExperimentSettings experimentName="" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Experiment name (optional)"), {
      target: { value: "my-experiment" }
    });

    expect(onChange).toHaveBeenCalledWith("my-experiment");
  });
});
