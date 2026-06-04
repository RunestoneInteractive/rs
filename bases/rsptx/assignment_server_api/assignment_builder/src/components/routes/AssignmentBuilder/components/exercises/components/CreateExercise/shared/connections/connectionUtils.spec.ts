import {
  CONNECTION_TOAST_COPY,
  blockLabelText,
  blockSide,
  connectionExistsBetween,
  makeConnectionLabelResolver
} from "./connectionUtils";

describe("CONNECTION_TOAST_COPY", () => {
  it("locks the CP65 strings", () => {
    expect(CONNECTION_TOAST_COPY.sameSideTitle).toBe("Can't connect these");
    expect(CONNECTION_TOAST_COPY.sameSideMessage).toBe(
      "Connections pair a source item with a target match. Pick items from opposite columns."
    );
    expect(CONNECTION_TOAST_COPY.duplicateTitle).toBe("Already connected");
    expect(CONNECTION_TOAST_COPY.duplicateMessage).toBe("These two items are already connected.");
  });
});

describe("blockSide", () => {
  const left = [{ id: "a", label: "Alpha" }];
  const right = [{ id: "x", label: "Xray" }];

  it("resolves the side structurally from the item lists", () => {
    expect(blockSide(left, right, "a")).toBe("left");
    expect(blockSide(left, right, "x")).toBe("right");
  });

  it("falls back to the id prefix when the id is in neither list", () => {
    expect(blockSide(left, right, "left-123")).toBe("left");
    expect(blockSide(left, right, "right-456")).toBe("right");
  });

  it("prefers the structural lookup over a misleading prefix", () => {
    expect(blockSide([{ id: "right-odd", label: "" }], right, "right-odd")).toBe("left");
  });
});

describe("connectionExistsBetween", () => {
  it("finds an existing ordered pair", () => {
    expect(connectionExistsBetween([["a", "x"]], "a", "x")).toBe(true);
  });

  it("does not match the reversed pair or other pairs", () => {
    expect(connectionExistsBetween([["a", "x"]], "x", "a")).toBe(false);
    expect(connectionExistsBetween([["a", "x"]], "a", "y")).toBe(false);
  });
});

describe("blockLabelText", () => {
  it("strips markup and collapses whitespace", () => {
    expect(blockLabelText("<p>Red  <strong>fruit</strong></p>", "fallback")).toBe("Red fruit");
  });

  it("returns the fallback for empty or markup-only content", () => {
    expect(blockLabelText("", "Source item 1")).toBe("Source item 1");
    expect(blockLabelText("<p></p>", "Source item 1")).toBe("Source item 1");
  });

  it("truncates long text with an ellipsis", () => {
    const text = "x".repeat(60);

    const label = blockLabelText(text, "fallback");

    expect(label.length).toBeLessThanOrEqual(40);
    expect(label.endsWith("…")).toBe(true);
  });
});

describe("makeConnectionLabelResolver", () => {
  const resolve = makeConnectionLabelResolver(
    [
      { id: "l1", label: "<p>Apple</p>" },
      { id: "l2", label: "" }
    ],
    [{ id: "r1", label: "" }]
  );

  it("uses the block content when present", () => {
    expect(resolve("l1")).toBe("Apple");
  });

  it("falls back to indexed side names for empty blocks", () => {
    expect(resolve("l2")).toBe("Source item 2");
    expect(resolve("r1")).toBe("Target match 1");
  });

  it("returns the id for unknown blocks", () => {
    expect(resolve("ghost")).toBe("ghost");
  });
});
