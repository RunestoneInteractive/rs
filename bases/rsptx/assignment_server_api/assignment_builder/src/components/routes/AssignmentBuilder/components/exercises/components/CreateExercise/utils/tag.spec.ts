import { addLanguageTag } from "./tag";

describe("addLanguageTag", () => {
  describe("when language is empty", () => {
    it("returns existingTags unchanged when language is an empty string", () => {
      const result = addLanguageTag("python,java", "");

      expect(result).toBe("python,java");
    });

    it("returns empty existingTags unchanged when language is empty", () => {
      const result = addLanguageTag("", "");

      expect(result).toBe("");
    });
  });

  describe("when existingTags is empty", () => {
    it("returns only the new language when there are no existing tags", () => {
      const result = addLanguageTag("", "python");

      expect(result).toBe("python");
    });
  });

  describe("when adding a new language", () => {
    it("appends the language to the existing tags", () => {
      const result = addLanguageTag("python", "java");

      expect(result).toBe("python,java");
    });

    it("appends the language to multiple existing tags", () => {
      const result = addLanguageTag("python,java", "javascript");

      expect(result).toBe("python,java,javascript");
    });

    it("trims whitespace from existing tags before appending", () => {
      const result = addLanguageTag("python , java ", "javascript");

      expect(result).toBe("python,java,javascript");
    });
  });

  describe("when the language already exists in tags", () => {
    it("does not add a duplicate tag", () => {
      const result = addLanguageTag("python,java", "python");

      expect(result).toBe("python,java");
    });

    it("does not add a duplicate tag when it is the only existing tag", () => {
      const result = addLanguageTag("python", "python");

      expect(result).toBe("python");
    });
  });

  describe("when replacing an old language", () => {
    it("removes the old language and adds the new one", () => {
      const result = addLanguageTag("python,java", "javascript", "python");

      expect(result).toBe("java,javascript");
    });

    it("replaces old language when it is the only existing tag", () => {
      const result = addLanguageTag("python", "java", "python");

      expect(result).toBe("java");
    });

    it("adds new language when old language is not in existing tags", () => {
      const result = addLanguageTag("python,java", "javascript", "ruby");

      expect(result).toBe("python,java,javascript");
    });

    it("does not duplicate new language when new language already exists and old is removed", () => {
      const result = addLanguageTag("python,javascript", "javascript", "python");

      expect(result).toBe("javascript");
    });

    it("removes old language and does not add new language if new language already exists", () => {
      const result = addLanguageTag("python,java,javascript", "java", "python");

      expect(result).toBe("java,javascript");
    });
  });

  describe("edge cases", () => {
    it("filters out empty strings that result from splitting an empty-like tags string", () => {
      const result = addLanguageTag(",,,", "python");

      expect(result).toBe("python");
    });

    it("handles a single tag that matches old language, replacing it with new language", () => {
      const result = addLanguageTag("old", "new", "old");

      expect(result).toBe("new");
    });

    it("preserves tags order for tags that are not removed or added", () => {
      const result = addLanguageTag("a,b,c", "d", "b");

      expect(result).toBe("a,c,d");
    });
  });
});
