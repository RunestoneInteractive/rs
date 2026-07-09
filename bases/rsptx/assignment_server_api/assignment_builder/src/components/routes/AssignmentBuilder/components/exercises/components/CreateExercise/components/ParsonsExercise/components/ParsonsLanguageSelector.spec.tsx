import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ParsonsLanguageSelector } from "./ParsonsLanguageSelector";

const baseOptions = [{ value: "python", label: "Python", description: "" }];

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector({})
}));

vi.mock("@/store/dataset/dataset.logic", () => ({
  datasetSelectors: { getLanguageOptions: () => baseOptions }
}));

describe("ParsonsLanguageSelector", () => {
  it("prepends a Text content option and selects it", async () => {
    const onChange = vi.fn();

    renderWithMantine(<ParsonsLanguageSelector language="" onChange={onChange} />);

    await userEvent.click(screen.getByPlaceholderText("Select content type"));
    await userEvent.click(screen.getByText("Text content"));

    expect(onChange).toHaveBeenCalledWith("text");
  });
});
