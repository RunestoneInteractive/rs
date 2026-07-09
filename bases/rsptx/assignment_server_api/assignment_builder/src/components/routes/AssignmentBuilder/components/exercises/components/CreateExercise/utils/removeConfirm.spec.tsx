import { modals } from "@mantine/modals";

import { REMOVE_BLOCK_CONFIRM, REMOVE_OPTION_CONFIRM, confirmRemoval } from "./removeConfirm";

vi.mock("@mantine/modals", () => ({
  modals: { openConfirmModal: vi.fn() }
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("confirmRemoval", () => {
  it("removes immediately when the item has no content", () => {
    const onConfirm = vi.fn();

    confirmRemoval({ hasContent: false, ...REMOVE_OPTION_CONFIRM, onConfirm });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(modals.openConfirmModal).not.toHaveBeenCalled();
  });

  it("asks for confirmation when the item has content", () => {
    const onConfirm = vi.fn();

    confirmRemoval({ hasContent: true, ...REMOVE_OPTION_CONFIRM, onConfirm });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(modals.openConfirmModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Remove option",
        labels: { confirm: "Remove", cancel: "Cancel" },
        onConfirm
      })
    );
  });

  it("uses canonical copy naming the consequence", () => {
    expect(REMOVE_OPTION_CONFIRM.message).toBe(
      "Remove this option? Its content can't be restored."
    );
    expect(REMOVE_BLOCK_CONFIRM.title).toBe("Remove block");
    expect(REMOVE_BLOCK_CONFIRM.message).toBe("Remove this block? Its content can't be restored.");
  });
});
