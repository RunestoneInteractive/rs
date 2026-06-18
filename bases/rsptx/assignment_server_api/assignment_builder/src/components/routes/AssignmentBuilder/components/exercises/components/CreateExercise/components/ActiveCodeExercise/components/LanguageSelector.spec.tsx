import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { LanguageSelector } from "./LanguageSelector";

const languageOptions = [
  { value: "python", label: "Python", description: "" },
  { value: "java", label: "Java", description: "" }
];

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector({}),
  useDispatch: () => vi.fn()
}));

vi.mock("@/store/dataset/dataset.logic", () => ({
  datasetSelectors: {
    getLanguageOptions: () => languageOptions
  }
}));

describe("LanguageSelector", () => {
  it("shows the selected language label", () => {
    renderWithMantine(<LanguageSelector language="python" onChange={vi.fn()} />);

    expect(screen.getByDisplayValue("Python")).toBeInTheDocument();
  });

  it("calls onChange with the chosen language value", async () => {
    const onChange = vi.fn();

    renderWithMantine(<LanguageSelector language="" onChange={onChange} />);

    await userEvent.click(screen.getByPlaceholderText("Select programming language"));
    await userEvent.click(screen.getByText("Java"));

    expect(onChange).toHaveBeenCalledWith("java");
  });
});
