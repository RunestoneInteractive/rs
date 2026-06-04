import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ParsonsOptions } from "./ParsonsOptions";

const baseProps = {
  adaptive: true,
  numbered: "left" as const,
  noindent: false,
  grader: "line" as const,
  orderMode: "random" as const,
  mode: "enhanced" as const,
  onAdaptiveChange: vi.fn(),
  onNumberedChange: vi.fn(),
  onNoindentChange: vi.fn(),
  onGraderChange: vi.fn(),
  onOrderModeChange: vi.fn()
};

describe("ParsonsOptions", () => {
  it("switching the grader to DAG disables adaptive", async () => {
    const onGraderChange = vi.fn();
    const onAdaptiveChange = vi.fn();

    renderWithMantine(
      <ParsonsOptions
        {...baseProps}
        onGraderChange={onGraderChange}
        onAdaptiveChange={onAdaptiveChange}
      />
    );

    await userEvent.click(screen.getByText("DAG"));

    expect(onGraderChange).toHaveBeenCalledWith("dag");
    expect(onAdaptiveChange).toHaveBeenCalledWith(false);
  });

  it("toggles the adaptive checkbox", async () => {
    const onAdaptiveChange = vi.fn();

    renderWithMantine(
      <ParsonsOptions {...baseProps} adaptive={false} onAdaptiveChange={onAdaptiveChange} />
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Adaptive" }));
    expect(onAdaptiveChange).toHaveBeenCalledWith(true);
  });
});
