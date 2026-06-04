import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { MultiChoiceExerciseSettings } from "./MultiChoiceExerciseSettings";

vi.mock("../../shared/BaseExerciseSettingsContent", () => ({
  BaseExerciseSettingsContent: () => <div data-testid="base-settings" />
}));

describe("MultiChoiceExerciseSettings", () => {
  it("toggles forceCheckboxes through onSettingsChange", async () => {
    const onSettingsChange = vi.fn();

    renderWithMantine(
      <MultiChoiceExerciseSettings
        initialData={{ forceCheckboxes: false }}
        onSettingsChange={onSettingsChange}
      />
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /Always show checkboxes/i }));

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ forceCheckboxes: true })
    );
  });
});
