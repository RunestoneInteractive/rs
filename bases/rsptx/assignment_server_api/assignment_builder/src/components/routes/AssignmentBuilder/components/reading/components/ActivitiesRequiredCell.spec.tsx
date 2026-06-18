import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { Exercise } from "@/types/exercises";

import { ActivitiesRequiredCell } from "./ActivitiesRequiredCell";

vi.mock("@components/ui/notify", () => ({
  notify: {
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    update: vi.fn(),
    hide: vi.fn(),
    clean: vi.fn()
  }
}));

import { notify } from "@components/ui/notify";

const reading = {
  id: 7,
  name: "1.2 Variables",
  title: "1.2 Variables",
  numQuestions: 5
} as unknown as Exercise;

describe("ActivitiesRequiredCell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names the input after the reading", () => {
    renderWithMantine(
      <ActivitiesRequiredCell value={3} exercise={reading} onUpdate={vi.fn()} itemId={7} />
    );

    expect(
      screen.getByRole("textbox", { name: "Required activities for 1.2 Variables" })
    ).toBeInTheDocument();
  });

  it("commits a valid value through onUpdate", async () => {
    const onUpdate = vi.fn();

    renderWithMantine(
      <ActivitiesRequiredCell value={3} exercise={reading} onUpdate={onUpdate} itemId={7} />
    );

    const input = screen.getByRole("textbox", { name: "Required activities for 1.2 Variables" });

    await userEvent.tripleClick(input);
    await userEvent.keyboard("4");

    expect(onUpdate).toHaveBeenLastCalledWith(7, "activities_required", 4);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("rejects a value above the activity count with the canonical toast", async () => {
    const onUpdate = vi.fn();

    renderWithMantine(
      <ActivitiesRequiredCell value={3} exercise={reading} onUpdate={onUpdate} itemId={7} />
    );

    const input = screen.getByRole("textbox", { name: "Required activities for 1.2 Variables" });

    await userEvent.tripleClick(input);
    await userEvent.keyboard("9");

    expect(notify.error).toHaveBeenCalledWith({
      title: "Too many required activities",
      message: "Required activities (9) can't exceed the activity count (5)."
    });
    expect(onUpdate).not.toHaveBeenCalledWith(7, "activities_required", 9);
  });
});
