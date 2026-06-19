import { useForm } from "react-hook-form";
import { vi } from "vitest";

import { fireEvent, renderWithMantine, screen } from "@/test/renderWithMantine";
import { Assignment } from "@/types/assignment";

import { VisibilityControl } from "./VisibilityControl";

interface HarnessProps {
  visible?: boolean;
  visibleOn?: string | null;
  hiddenOn?: string | null;
  onSetValue?: (name: string, value: unknown) => void;
}

const Harness = ({
  visible = true,
  visibleOn = null,
  hiddenOn = null,
  onSetValue = vi.fn()
}: HarnessProps) => {
  const { control, watch, setValue } = useForm<Assignment>({
    defaultValues: {
      visible,
      visible_on: visibleOn,
      hidden_on: hiddenOn
    } as Partial<Assignment>
  });

  const spiedSetValue: typeof setValue = (name, value, options) => {
    onSetValue(name as string, value);
    setValue(name, value, options);
  };

  return (
    <VisibilityControl
      control={control}
      watch={watch as (name: keyof Assignment) => unknown}
      setValue={spiedSetValue}
    />
  );
};

describe("VisibilityControl", () => {
  it("renders all five visibility mode cards", () => {
    renderWithMantine(<Harness />);

    expect(screen.getByText("Visible")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByText("Make visible on a date")).toBeInTheDocument();
    expect(screen.getByText("Hide on a date")).toBeInTheDocument();
    expect(screen.getByText("Visible during a period")).toBeInTheDocument();
  });

  it("marks the card matching the current form values as checked", () => {
    renderWithMantine(<Harness visible={false} visibleOn="2026-07-01T00:00:00" />);

    const checked = screen.getByRole("radio", { checked: true });

    expect(checked).toHaveTextContent("Make visible on a date");
  });

  it("clears schedule dates when switching to Hidden", () => {
    const onSetValue = vi.fn();

    renderWithMantine(
      <Harness visible={false} visibleOn="2026-07-01T00:00:00" onSetValue={onSetValue} />
    );

    fireEvent.click(screen.getByText("Hidden"));

    expect(onSetValue).toHaveBeenCalledWith("visible", false);
    expect(onSetValue).toHaveBeenCalledWith("visible_on", null);
    expect(onSetValue).toHaveBeenCalledWith("hidden_on", null);
  });

  it("seeds a visible_on date when switching to scheduled visibility", () => {
    const onSetValue = vi.fn();

    renderWithMantine(<Harness visible onSetValue={onSetValue} />);

    fireEvent.click(screen.getByText("Make visible on a date"));

    expect(onSetValue).toHaveBeenCalledWith("visible", false);
    expect(onSetValue).toHaveBeenCalledWith("hidden_on", null);
    expect(onSetValue).toHaveBeenCalledWith("visible_on", expect.any(String));
  });

  it("shows a single date input under the selected scheduled card", () => {
    renderWithMantine(<Harness visible={false} visibleOn="2026-07-01T00:00:00" />);

    expect(screen.getByPlaceholderText("Select date and time")).toBeInTheDocument();
    expect(screen.queryByText("Visible from")).not.toBeInTheDocument();
  });

  it("shows both period inputs and the summary for a scheduled period", () => {
    renderWithMantine(
      <Harness visible={false} visibleOn="2026-07-01T00:00:00" hiddenOn="2026-08-01T00:00:00" />
    );

    expect(screen.getByText("Visible from")).toBeInTheDocument();
    expect(screen.getByText("Hidden after")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Select date and time")).toHaveLength(2);
    expect(screen.getByText(/Assignment will be visible from/)).toBeInTheDocument();
  });

  it("shows the summary line for the visible mode", () => {
    renderWithMantine(<Harness visible />);

    expect(screen.getByText("Assignment is currently visible to students")).toBeInTheDocument();
  });
});
