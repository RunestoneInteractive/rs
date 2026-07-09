import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { FilterMultiSelect } from "./FilterMultiSelect";

const OPTIONS = [
  { label: "Multiple Choice", value: "mchoice" },
  { label: "ActiveCode", value: "activecode" },
  { label: "Parsons", value: "parsons" }
];

const MANY_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  label: `Type ${i + 1}`,
  value: `type-${i + 1}`
}));

describe("FilterMultiSelect", () => {
  it("renders the label without a count badge when nothing is selected", () => {
    renderWithMantine(
      <FilterMultiSelect label="Exercise types" options={OPTIONS} value={[]} onChange={vi.fn()} />
    );

    const target = screen.getByRole("button", { name: "Exercise types" });

    expect(target).toBeInTheDocument();
    expect(target).not.toHaveAttribute("data-active");
  });

  it("shows the selected count on the target and marks it active", () => {
    renderWithMantine(
      <FilterMultiSelect
        label="Exercise types"
        options={OPTIONS}
        value={["mchoice", "parsons"]}
        onChange={vi.fn()}
      />
    );

    const target = screen.getByRole("button", { name: "Exercise types" });

    expect(target).toHaveAttribute("data-active");
    expect(target).toHaveTextContent("2");
  });

  it("adds a value when an unchecked option is toggled", async () => {
    const onChange = vi.fn();

    renderWithMantine(
      <FilterMultiSelect
        label="Exercise types"
        options={OPTIONS}
        value={["mchoice"]}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Exercise types" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "ActiveCode" }));

    expect(onChange).toHaveBeenCalledWith(["mchoice", "activecode"]);
  });

  it("removes a value when a checked option is toggled", async () => {
    const onChange = vi.fn();

    renderWithMantine(
      <FilterMultiSelect
        label="Exercise types"
        options={OPTIONS}
        value={["mchoice", "parsons"]}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Exercise types" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Parsons" }));

    expect(onChange).toHaveBeenCalledWith(["mchoice"]);
  });

  it("clears the whole selection from the footer", async () => {
    const onChange = vi.fn();

    renderWithMantine(
      <FilterMultiSelect
        label="Exercise types"
        options={OPTIONS}
        value={["mchoice", "parsons"]}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Exercise types" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("filters options through the search input when there are many options", async () => {
    renderWithMantine(
      <FilterMultiSelect
        label="Exercise types"
        options={MANY_OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Exercise types" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Search exercise types" }), "10");

    expect(screen.getByRole("checkbox", { name: "Type 10" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Type 1" })).not.toBeInTheDocument();
  });

  it("hides the search input for short option lists", async () => {
    renderWithMantine(
      <FilterMultiSelect label="Exercise types" options={OPTIONS} value={[]} onChange={vi.fn()} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Exercise types" }));
    expect(
      screen.queryByRole("textbox", { name: "Search exercise types" })
    ).not.toBeInTheDocument();
  });
});
