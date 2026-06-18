import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { CreateExerciseFormType } from "@/types/exercises";

import { ActiveCodeExerciseSettings } from "./ActiveCodeExerciseSettings";

vi.mock("../../shared/BaseExerciseSettingsContent", () => ({
  BaseExerciseSettingsContent: ({ additionalFields }: { additionalFields: ReactNode }) => (
    <div>{additionalFields}</div>
  )
}));

const renderSettings = (formData: Partial<CreateExerciseFormType>, onChange = vi.fn()) => {
  renderWithMantine(<ActiveCodeExerciseSettings formData={formData} onChange={onChange} />);
  return onChange;
};

describe("ActiveCodeExerciseSettings", () => {
  it("enables CodeTailor and seeds the personalization default", async () => {
    const onChange = renderSettings({ enableCodeTailor: false });

    await userEvent.click(screen.getByRole("switch", { name: /Personalized Parsons Support/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enableCodeTailor: true, parsonspersonalize: "movable" })
    );
  });

  it("shows the personalization options only when CodeTailor is enabled", () => {
    renderSettings({ enableCodeTailor: true });

    expect(screen.getByText("Personalized blocks to arrange")).toBeInTheDocument();
    expect(screen.getByText("Backup example solution")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Parsons problem ID (optional)")).toBeInTheDocument();
    expect(screen.getByText("Show CodeLens button")).toBeInTheDocument();
  });

  it("resets personalization fields when CodeTailor is disabled", async () => {
    const onChange = renderSettings({ enableCodeTailor: true, parsonsexample: "abc" });

    await userEvent.click(screen.getByRole("switch", { name: /Personalized Parsons Support/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        enableCodeTailor: false,
        parsonspersonalize: "",
        parsonsexample: ""
      })
    );
  });
});
