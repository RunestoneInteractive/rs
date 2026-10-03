import { parseAssociations } from "../parseAssociations";

describe("parseAssociations", () => {
  it("keeps only valid matching connections", () => {
    const answer = JSON.stringify({
      connections: [{ from: "left-1", to: "right-1" }, { from: "left-2" }, null, "invalid"]
    });

    expect(parseAssociations("matching", answer)).toEqual([{ from: "left-1", to: "right-1" }]);
  });

  it("flattens drag-and-drop zones and ignores invalid values", () => {
    expect(
      parseAssociations("dragndrop", '{"zone-1":["item-1",5,"item-2"],"zone-2":null}')
    ).toEqual([
      { from: "item-1", to: "zone-1" },
      { from: "item-2", to: "zone-1" }
    ]);
  });
});
