import { safeJsonParse } from "./json";

describe("safeJsonParse", () => {
  describe("when given an object value", () => {
    it("returns the object as-is when passed a plain object", () => {
      const input = { foo: "bar", count: 42 };
      const result = safeJsonParse<typeof input>(input);
      expect(result).toBe(input);
    });

    it("returns the array as-is when passed an array", () => {
      const input = [1, 2, 3];
      const result = safeJsonParse<number[]>(input);
      expect(result).toBe(input);
    });

    it("returns the nested object as-is", () => {
      const input = { nested: { a: 1 } };
      const result = safeJsonParse<typeof input>(input);
      expect(result).toBe(input);
    });
  });

  describe("when given a valid JSON string", () => {
    it("parses a JSON object string and returns the parsed object", () => {
      const result = safeJsonParse<{ name: string }>('{"name":"Alice"}');
      expect(result).toEqual({ name: "Alice" });
    });

    it("parses a JSON array string and returns the parsed array", () => {
      const result = safeJsonParse<number[]>("[1,2,3]");
      expect(result).toEqual([1, 2, 3]);
    });

    it("parses a JSON number string and returns the number", () => {
      const result = safeJsonParse<number>("42");
      expect(result).toBe(42);
    });

    it("parses a JSON boolean string and returns the boolean", () => {
      const result = safeJsonParse<boolean>("true");
      expect(result).toBe(true);
    });

    it("parses a JSON null string and returns null", () => {
      const result = safeJsonParse<null>("null");
      expect(result).toBeNull();
    });

    it("parses a JSON string value and returns the string", () => {
      const result = safeJsonParse<string>('"hello"');
      expect(result).toBe("hello");
    });
  });

  describe("when given an invalid JSON string", () => {
    it("returns undefined for a malformed JSON string", () => {
      const result = safeJsonParse("{invalid json}");
      expect(result).toBeUndefined();
    });

    it("returns undefined for an empty string", () => {
      const result = safeJsonParse("");
      expect(result).toBeUndefined();
    });

    it("returns undefined for a plain text string", () => {
      const result = safeJsonParse("not json");
      expect(result).toBeUndefined();
    });

    it("returns undefined for an unterminated JSON string", () => {
      const result = safeJsonParse('{"key": "value"');
      expect(result).toBeUndefined();
    });
  });

  describe("null handling", () => {
    it("parses a 'null' string and returns null (not object branch)", () => {
      const result = safeJsonParse<null>("null");
      expect(result).toBeNull();
    });
  });
});
