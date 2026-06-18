import { notifications } from "@mantine/notifications";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { notify } from "./notify";

vi.mock("@mantine/notifications", () => ({
  notifications: {
    show: vi.fn(() => "toast-id"),
    update: vi.fn(),
    hide: vi.fn(),
    clean: vi.fn()
  }
}));

describe("notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("show wraps a plain string into a polite brand notification", () => {
    const id = notify.show("Saved draft");

    expect(id).toBe("toast-id");
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Saved draft", color: "brand", role: "status" })
    );
  });

  it("success uses teal, a status icon, and a polite live region", () => {
    notify.success("Assignment created");

    const data = vi.mocked(notifications.show).mock.calls[0][0];

    expect(data).toMatchObject({ message: "Assignment created", color: "teal", role: "status" });
    expect(data.icon).toBeTruthy();
    expect(data.autoClose).toBeUndefined();
  });

  it("error persists until dismissed and keeps the assertive default role", () => {
    notify.error("Couldn't save grade. Try again.");

    const data = vi.mocked(notifications.show).mock.calls[0][0];

    expect(data).toMatchObject({
      message: "Couldn't save grade. Try again.",
      color: "red",
      autoClose: false
    });
    expect(data.icon).toBeTruthy();
    expect(data.role).toBeUndefined();
  });

  it("explicit fields on object input override the per-status defaults", () => {
    notify.error({ message: "Slow down", autoClose: 5000, color: "yellow" });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Slow down", autoClose: 5000, color: "yellow" })
    );
  });

  it("info uses blue with an icon", () => {
    notify.info("Rosters sync nightly");

    const data = vi.mocked(notifications.show).mock.calls[0][0];

    expect(data).toMatchObject({ color: "blue", role: "status" });
    expect(data.icon).toBeTruthy();
  });

  it("update, hide, and clean delegate to the notifications store", () => {
    notify.update("toast-id", "Still working");
    notify.hide("toast-id");
    notify.clean();

    expect(notifications.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "toast-id", message: "Still working" })
    );
    expect(notifications.hide).toHaveBeenCalledWith("toast-id");
    expect(notifications.clean).toHaveBeenCalled();
  });
});
