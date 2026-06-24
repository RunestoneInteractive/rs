import { sanitizeId, validateIdName } from "./sanitize";

describe("sanitizeId", () => {
  describe("when name contains only valid characters", () => {
    it("returns the name unchanged if it starts with a letter and has valid chars", () => {
      const result = sanitizeId("myId");
      expect(result).toBe("myId");
    });

    it("preserves hyphens and underscores", () => {
      const result = sanitizeId("my-id_name");
      expect(result).toBe("my-id_name");
    });

    it("preserves alphanumeric characters", () => {
      const result = sanitizeId("abc123");
      expect(result).toBe("abc123");
    });
  });

  describe("when name contains invalid characters", () => {
    it("removes spaces from the name", () => {
      const result = sanitizeId("my id");
      expect(result).toBe("myid");
    });

    it("removes special characters like @, #, $", () => {
      const result = sanitizeId("my@id#name$");
      expect(result).toBe("myidname");
    });

    it("removes dots from the name", () => {
      const result = sanitizeId("my.id.name");
      expect(result).toBe("myidname");
    });
  });

  describe("when sanitized result does not start with a letter", () => {
    it("prepends id_ when name starts with a digit", () => {
      const result = sanitizeId("123name");
      expect(result).toBe("id_123name");
    });

    it("prepends id_ when name starts with an underscore", () => {
      const result = sanitizeId("_name");
      expect(result).toBe("id__name");
    });

    it("prepends id_ when name starts with a hyphen", () => {
      const result = sanitizeId("-name");
      expect(result).toBe("id_-name");
    });

    it("prepends id_ when all valid chars are digits", () => {
      const result = sanitizeId("456");
      expect(result).toBe("id_456");
    });
  });

  describe("fallback behavior", () => {
    it("uses fallback when name is an empty string", () => {
      const result = sanitizeId("", "fallbackId");
      expect(result).toBe("fallbackId");
    });

    it("uses fallback when name is a falsy empty string and fallback starts with a letter", () => {
      const result = sanitizeId("", "abc");
      expect(result).toBe("abc");
    });

    it("generates a timestamp-based id when both name and fallback are empty strings", () => {
      const result = sanitizeId("", "");
      expect(result).toMatch(/^generated_\d+$/);
    });

    it("generates a timestamp-based id when name is empty and no fallback is provided", () => {
      const result = sanitizeId("");
      expect(result).toMatch(/^generated_\d+$/);
    });

    it("uses fallback when name is empty and fallback starts with a digit", () => {
      const result = sanitizeId("", "123fallback");
      expect(result).toBe("id_123fallback");
    });
  });

  describe("edge cases", () => {
    it("prepends id_ when name becomes empty after stripping invalid chars, ignoring fallback", () => {
      const result = sanitizeId("@@@", "fallback");
      expect(result).toBe("id_");
    });

    it("prepends id_ when name consisting entirely of invalid chars produces an empty sanitized string", () => {
      const result = sanitizeId("@@@");
      expect(result).toBe("id_");
    });

    it("handles uppercase letters correctly", () => {
      const result = sanitizeId("MyID");
      expect(result).toBe("MyID");
    });

    it("handles mixed valid and invalid characters", () => {
      const result = sanitizeId("hello world!");
      expect(result).toBe("helloworld");
    });
  });
});

describe("validateIdName", () => {
  describe("when name is empty or blank", () => {
    it("returns required error for empty string", () => {
      const result = validateIdName("");
      expect(result).toBe("Name is required");
    });

    it("returns required error for whitespace-only string", () => {
      const result = validateIdName("   ");
      expect(result).toBe("Name is required");
    });

    it("returns required error for a single space", () => {
      const result = validateIdName(" ");
      expect(result).toBe("Name is required");
    });
  });

  describe("when name is too short", () => {
    it("returns length error for a single letter", () => {
      const result = validateIdName("a");
      expect(result).toBe("Name must be at least 2 characters long");
    });

    it("returns length error for a single digit (even though it would also fail start-with-letter)", () => {
      const result = validateIdName("1");
      expect(result).toBe("Name must be at least 2 characters long");
    });
  });

  describe("when name contains invalid characters", () => {
    it("returns character error for a name with spaces", () => {
      const result = validateIdName("my name");
      expect(result).toBe("Name can only contain letters, numbers, hyphens, and underscores");
    });

    it("returns character error for a name with a dot", () => {
      const result = validateIdName("my.name");
      expect(result).toBe("Name can only contain letters, numbers, hyphens, and underscores");
    });

    it("returns character error for a name with special symbols", () => {
      const result = validateIdName("name@domain");
      expect(result).toBe("Name can only contain letters, numbers, hyphens, and underscores");
    });
  });

  describe("when name starts with a non-letter", () => {
    it("returns start-with-letter error for name beginning with a digit", () => {
      const result = validateIdName("1name");
      expect(result).toBe("Name must start with a letter");
    });

    it("returns start-with-letter error for name beginning with an underscore", () => {
      const result = validateIdName("_name");
      expect(result).toBe("Name must start with a letter");
    });

    it("returns start-with-letter error for name beginning with a hyphen", () => {
      const result = validateIdName("-name");
      expect(result).toBe("Name must start with a letter");
    });
  });

  describe("when name is valid", () => {
    it("returns null for a simple alphabetic name", () => {
      const result = validateIdName("myName");
      expect(result).toBeNull();
    });

    it("returns null for a name with letters and numbers", () => {
      const result = validateIdName("name123");
      expect(result).toBeNull();
    });

    it("returns null for a name with hyphens", () => {
      const result = validateIdName("my-name");
      expect(result).toBeNull();
    });

    it("returns null for a name with underscores", () => {
      const result = validateIdName("my_name");
      expect(result).toBeNull();
    });

    it("returns null for a two-character valid name", () => {
      const result = validateIdName("ab");
      expect(result).toBeNull();
    });

    it("returns null for a name with mixed allowed characters", () => {
      const result = validateIdName("myId_123-test");
      expect(result).toBeNull();
    });
  });
});
