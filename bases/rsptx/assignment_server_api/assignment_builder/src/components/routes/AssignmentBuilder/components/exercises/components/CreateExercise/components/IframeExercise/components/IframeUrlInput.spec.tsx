import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { IframeUrlInput } from "./IframeUrlInput";

let showValidation = false;

vi.mock("../../../shared/ExerciseLayout", () => ({
  useValidation: () => ({ shouldShowValidation: showValidation })
}));

vi.mock("../../../shared/styles/CreateExercise.module.css", () => ({ default: {} }));

beforeEach(() => {
  showValidation = false;
});

describe("IframeUrlInput", () => {
  it("renders the current url value", () => {
    renderWithMantine(<IframeUrlInput iframeSrc="https://example.com" onChange={vi.fn()} />);

    expect(screen.getByLabelText(/Iframe URL/)).toHaveValue("https://example.com");
  });

  it("calls onChange when the url is edited", () => {
    const onChange = vi.fn();

    renderWithMantine(<IframeUrlInput iframeSrc="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/Iframe URL/), {
      target: { value: "https://new.com" }
    });

    expect(onChange).toHaveBeenCalledWith("https://new.com");
  });

  it("shows the required error when empty and validation is active", () => {
    showValidation = true;

    renderWithMantine(<IframeUrlInput iframeSrc="" onChange={vi.fn()} />);

    expect(screen.getByText("Iframe URL is required")).toBeInTheDocument();
  });

  it("shows the invalid-url error for malformed input when validation is active", () => {
    showValidation = true;

    renderWithMantine(<IframeUrlInput iframeSrc="not-a-url" onChange={vi.fn()} />);

    expect(screen.getByText("Enter a valid URL (https://…)")).toBeInTheDocument();
  });

  it("renders the preview iframe for a valid url", () => {
    renderWithMantine(<IframeUrlInput iframeSrc="https://example.com" onChange={vi.fn()} />);

    expect(screen.getByTitle("Iframe preview")).toBeInTheDocument();
  });
});
