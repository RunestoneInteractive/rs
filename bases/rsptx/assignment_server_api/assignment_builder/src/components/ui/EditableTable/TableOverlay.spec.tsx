import { describe, expect, it } from "vitest";

import { getRangeUpdateToastCopy } from "./TableOverlay";

describe("getRangeUpdateToastCopy", () => {
  it("reports a plural exercises update without filler words", () => {
    expect(getRangeUpdateToastCopy("exercises", 3).success).toBe("Updated 3 exercises");
  });

  it("uses the singular noun for a single updated row", () => {
    expect(getRangeUpdateToastCopy("exercises", 1).success).toBe("Updated 1 exercise");
    expect(getRangeUpdateToastCopy("readings", 1).success).toBe("Updated 1 reading");
  });

  it("phrases the failure with a fix and no vague title", () => {
    expect(getRangeUpdateToastCopy("readings", 2).error).toBe(
      "Couldn't update readings. Try again."
    );
    expect(getRangeUpdateToastCopy("exercises", 2).error).toBe(
      "Couldn't update exercises. Try again."
    );
  });
});
