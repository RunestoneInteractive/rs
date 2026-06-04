import { isTipTapContentEmpty, validateCommonFields } from "./validation";

describe("isTipTapContentEmpty", () => {
  it("returns true for an empty string", () => {
    expect(isTipTapContentEmpty("")).toBe(true);
  });

  it("returns true for a whitespace-only string", () => {
    expect(isTipTapContentEmpty("   ")).toBe(true);
  });

  it("returns true for an empty paragraph tag", () => {
    expect(isTipTapContentEmpty("<p></p>")).toBe(true);
  });

  it("returns true for a paragraph tag containing only a space", () => {
    expect(isTipTapContentEmpty("<p> </p>")).toBe(true);
  });

  it("returns false for content containing a YouTube embed div", () => {
    expect(isTipTapContentEmpty('<div data-youtube-video="xyz"></div>')).toBe(false);
  });

  it("returns false for content containing an iframe", () => {
    expect(isTipTapContentEmpty('<iframe src="https://example.com"></iframe>')).toBe(false);
  });

  it("returns false for content containing an img tag", () => {
    expect(isTipTapContentEmpty('<img src="photo.png" />')).toBe(false);
  });

  it("returns false for a paragraph with actual text", () => {
    expect(isTipTapContentEmpty("<p>Hello world</p>")).toBe(false);
  });

  it("returns true when HTML tags wrap only whitespace", () => {
    expect(isTipTapContentEmpty("<p>   </p>")).toBe(true);
  });

  it("returns true when multiple empty HTML tags are present", () => {
    expect(isTipTapContentEmpty("<p><br></p>")).toBe(true);
  });

  it("returns false when there is mixed content with text and HTML", () => {
    expect(isTipTapContentEmpty("<p>Some <strong>text</strong></p>")).toBe(false);
  });
});

describe("validateCommonFields", () => {
  const validBase = {
    name: "Exercise 1",
    chapter: "chapter-1",
    subchapter: "section-1",
    points: 5,
    difficulty: 2
  };

  it("returns no errors when all fields are valid", () => {
    expect(validateCommonFields(validBase)).toEqual([]);
  });

  it("returns an error when name is missing", () => {
    const errors = validateCommonFields({ ...validBase, name: undefined });
    expect(errors).toContain("Exercise name is required");
  });

  it("returns an error when name is an empty string", () => {
    const errors = validateCommonFields({ ...validBase, name: "" });
    expect(errors).toContain("Exercise name is required");
  });

  it("returns an error when name is whitespace only", () => {
    const errors = validateCommonFields({ ...validBase, name: "   " });
    expect(errors).toContain("Exercise name is required");
  });

  it("returns an error when chapter is missing", () => {
    const errors = validateCommonFields({ ...validBase, chapter: undefined });
    expect(errors).toContain("Chapter is required");
  });

  it("returns an error when chapter is an empty string", () => {
    const errors = validateCommonFields({ ...validBase, chapter: "" });
    expect(errors).toContain("Chapter is required");
  });

  it("returns an error when subchapter is missing", () => {
    const errors = validateCommonFields({
      ...validBase,
      subchapter: undefined
    });
    expect(errors).toContain("Section is required");
  });

  it("returns an error when subchapter is an empty string", () => {
    const errors = validateCommonFields({ ...validBase, subchapter: "" });
    expect(errors).toContain("Section is required");
  });

  it("returns an error when points is undefined", () => {
    const errors = validateCommonFields({ ...validBase, points: undefined });
    expect(errors).toContain("Points must be greater than 0");
  });

  it("returns an error when points is zero", () => {
    const errors = validateCommonFields({ ...validBase, points: 0 });
    expect(errors).toContain("Points must be greater than 0");
  });

  it("returns an error when points is negative", () => {
    const errors = validateCommonFields({ ...validBase, points: -1 });
    expect(errors).toContain("Points must be greater than 0");
  });

  it("returns an error when difficulty is undefined", () => {
    const errors = validateCommonFields({
      ...validBase,
      difficulty: undefined
    });
    expect(errors).toContain("Difficulty is required");
  });

  it("does not return a difficulty error when difficulty is 0", () => {
    const errors = validateCommonFields({ ...validBase, difficulty: 0 });
    expect(errors).not.toContain("Difficulty is required");
  });

  it("returns multiple errors when several fields are invalid", () => {
    const errors = validateCommonFields({});
    expect(errors).toContain("Exercise name is required");
    expect(errors).toContain("Chapter is required");
    expect(errors).toContain("Section is required");
    expect(errors).toContain("Points must be greater than 0");
    expect(errors).toContain("Difficulty is required");
    expect(errors).toHaveLength(5);
  });

  it("returns errors only for invalid fields when some are valid", () => {
    const errors = validateCommonFields({
      name: "Valid Name",
      chapter: "ch1",
      subchapter: undefined,
      points: 3,
      difficulty: undefined
    });
    expect(errors).not.toContain("Exercise name is required");
    expect(errors).not.toContain("Chapter is required");
    expect(errors).toContain("Section is required");
    expect(errors).not.toContain("Points must be greater than 0");
    expect(errors).toContain("Difficulty is required");
    expect(errors).toHaveLength(2);
  });
});
