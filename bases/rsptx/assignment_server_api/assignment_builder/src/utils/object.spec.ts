import { isEmptyObject, dumpObject } from "@/utils/object";

describe("isEmptyObject", () => {
  it("returns true for an object with no own keys", () => {
    expect(isEmptyObject({})).toBe(true);
  });

  it("returns false for an object with at least one key", () => {
    expect(isEmptyObject({ a: 1 })).toBe(false);
  });

  it("returns false for an object with multiple keys", () => {
    expect(isEmptyObject({ x: 1, y: 2, z: 3 })).toBe(false);
  });

  it("returns false for an object with a key whose value is undefined", () => {
    expect(isEmptyObject({ key: undefined })).toBe(false);
  });

  it("returns false for an object with a key whose value is null", () => {
    expect(isEmptyObject({ key: null })).toBe(false);
  });

  it("returns false for an object with a key whose value is an empty string", () => {
    expect(isEmptyObject({ key: "" })).toBe(false);
  });
});

describe("dumpObject", () => {
  it("serializes a plain object with default spacing of 2", () => {
    const result = dumpObject({ a: 1 });
    expect(result).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  it("serializes a nested object", () => {
    const data = { outer: { inner: "value" } };
    expect(dumpObject(data)).toBe(JSON.stringify(data, null, 2));
  });

  it("serializes an array", () => {
    const data = [1, 2, 3];
    expect(dumpObject(data)).toBe(JSON.stringify(data, null, 2));
  });

  it("serializes a primitive string", () => {
    expect(dumpObject("hello")).toBe(JSON.stringify("hello", null, 2));
  });

  it("serializes null", () => {
    expect(dumpObject(null)).toBe("null");
  });

  it("serializes a number", () => {
    expect(dumpObject(42)).toBe("42");
  });

  it("respects a custom spacing argument", () => {
    const data = { key: "val" };
    expect(dumpObject(data, 4)).toBe(JSON.stringify(data, null, 4));
  });

  it("serializes with spacing 0 producing compact JSON", () => {
    const data = { a: 1, b: 2 };
    expect(dumpObject(data, 0)).toBe(JSON.stringify(data, null, 0));
  });

  it("returns an error message when the data cannot be serialized", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = dumpObject(circular);
    expect(result).toMatch(/^Error: Unable to serialize the provided data/);
  });
});
