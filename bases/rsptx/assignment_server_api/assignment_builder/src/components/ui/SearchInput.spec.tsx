import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithMantine } from "@/test/renderWithMantine";

import { SearchInput } from "./SearchInput";

describe("SearchInput", () => {
  it("renders the current value and placeholder", () => {
    renderWithMantine(
      <SearchInput value="hello" onChange={vi.fn()} placeholder="Search exercises..." />
    );

    const input = screen.getByPlaceholderText("Search exercises...") as HTMLInputElement;
    expect(input.value).toBe("hello");
  });

  it("emits the new value on change", () => {
    const onChange = vi.fn();
    renderWithMantine(<SearchInput value="" onChange={onChange} placeholder="Search" />);

    fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "loops" } });

    expect(onChange).toHaveBeenCalledWith("loops");
  });

  it("takes its accessible name from the placeholder by default", () => {
    renderWithMantine(<SearchInput value="" onChange={vi.fn()} placeholder="Search readings" />);

    expect(screen.getByRole("textbox", { name: "Search readings" })).toBeInTheDocument();
  });

  it("prefers an explicit ariaLabel over the placeholder", () => {
    renderWithMantine(
      <SearchInput value="" onChange={vi.fn()} placeholder="Search…" ariaLabel="Search exercises" />
    );

    expect(screen.getByRole("textbox", { name: "Search exercises" })).toBeInTheDocument();
  });

  it("falls back to a generic search name without a placeholder", () => {
    renderWithMantine(<SearchInput value="" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
  });
});
