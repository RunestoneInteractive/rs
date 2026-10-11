import { extractFrameSpec } from "../extractFrameSpec";

describe("extractFrameSpec", () => {
  it("extracts iframe attributes", () => {
    expect(extractFrameSpec('<iframe src="/activity" style="height: 20px"></iframe>')).toEqual({
      src: "/activity",
      style: "height: 20px"
    });
  });

  it("rejects incomplete markup", () => {
    expect(extractFrameSpec("<iframe></iframe>")).toBeNull();
    expect(extractFrameSpec()).toBeNull();
  });
});
