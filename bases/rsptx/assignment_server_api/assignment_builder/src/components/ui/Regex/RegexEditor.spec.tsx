import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithMantine } from "@/test/renderWithMantine";

import { RegexEditor } from "./RegexEditor";

describe("RegexEditor", () => {
  it("emits the pattern value as the user types", () => {
    const onChange = vi.fn();
    renderWithMantine(<RegexEditor value="" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Regex pattern"), {
      target: { value: "abc" }
    });

    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("flags an invalid regular expression", () => {
    renderWithMantine(<RegexEditor value="" onChange={vi.fn()} />);

    const pattern = screen.getByPlaceholderText("Regex pattern");
    fireEvent.change(pattern, { target: { value: "[" } });

    expect(pattern).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a positive result when the test text matches", () => {
    renderWithMantine(<RegexEditor value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Regex pattern"), {
      target: { value: "a" }
    });
    fireEvent.change(screen.getByPlaceholderText("Test text…"), {
      target: { value: "abc" }
    });
    fireEvent.click(screen.getByLabelText("Test regex"));

    expect(screen.getByText("Match")).toBeInTheDocument();
  });

  it("shows a negative result when the test text does not match", () => {
    renderWithMantine(<RegexEditor value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Regex pattern"), {
      target: { value: "z" }
    });
    fireEvent.change(screen.getByPlaceholderText("Test text…"), {
      target: { value: "abc" }
    });
    fireEvent.click(screen.getByLabelText("Test regex"));

    expect(screen.getByText("No Match")).toBeInTheDocument();
  });

  it("closes the matches popup", () => {
    renderWithMantine(<RegexEditor value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Regex pattern"), {
      target: { value: "a" }
    });
    fireEvent.change(screen.getByPlaceholderText("Test text…"), {
      target: { value: "abc" }
    });
    fireEvent.click(screen.getByLabelText("Test regex"));
    expect(screen.getByText("Match")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close matches"));

    expect(screen.queryByText("Match")).not.toBeInTheDocument();
  });
});
