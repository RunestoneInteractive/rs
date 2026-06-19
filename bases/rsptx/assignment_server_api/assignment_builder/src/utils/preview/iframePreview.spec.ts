import { generateIframePreview } from "./iframePreview";

describe("generateIframePreview", () => {
  it("wraps the iframe src in the expected runestone HTML structure", () => {
    const result = generateIframePreview("https://example.com/preview", "myQuestion");

    expect(result).toContain('<div class="runestone">');
    expect(result).toContain('data-component="splice"');
    expect(result).toContain('<iframe src="https://example.com/preview"');
    expect(result).toContain("allowfullscreen");
  });

  it("uses sanitized question name as the id attribute", () => {
    const result = generateIframePreview("https://example.com/preview", "question-1");

    expect(result).toContain('id="question-1"');
  });

  it("strips invalid characters from question name when setting the id", () => {
    const result = generateIframePreview("https://example.com/preview", "my question!");

    expect(result).toContain('id="myquestion"');
    expect(result).not.toContain("my question!");
  });

  it("prepends id_ when question name starts with a digit after sanitization", () => {
    const result = generateIframePreview("https://example.com/preview", "123question");

    expect(result).toContain('id="id_123question"');
  });

  it("inlines the iframe src exactly as provided", () => {
    const src = "https://cdn.example.org/q?id=42&token=abc";
    const result = generateIframePreview(src, "validName");

    expect(result).toContain(`src="${src}"`);
  });

  it("sets width to 100% and removes border on the iframe", () => {
    const result = generateIframePreview("https://example.com", "validName");

    expect(result).toContain('style="width: 100%; border: none;"');
  });

  it("nests the iframe inside the splice div which is inside the runestone div", () => {
    const result = generateIframePreview("https://example.com", "validName");

    const runestoneIndex = result.indexOf('<div class="runestone">');
    const spliceIndex = result.indexOf('data-component="splice"');
    const iframeIndex = result.indexOf("<iframe");
    const iframeCloseIndex = result.indexOf("</iframe>");
    const spliceDivCloseIndex = result.indexOf("</div>", iframeCloseIndex);
    const runestoneCloseIndex = result.indexOf("</div>", spliceDivCloseIndex + 1);

    expect(runestoneIndex).toBeLessThan(spliceIndex);
    expect(spliceIndex).toBeLessThan(iframeIndex);
    expect(iframeIndex).toBeLessThan(iframeCloseIndex);
    expect(iframeCloseIndex).toBeLessThan(spliceDivCloseIndex);
    expect(spliceDivCloseIndex).toBeLessThan(runestoneCloseIndex);
  });

  it("generates a valid id when question name contains only special characters", () => {
    const result = generateIframePreview("https://example.com", "!@#$%");

    expect(result).toContain('id="id_"');
  });

  it("preserves hyphens and underscores in the question name id", () => {
    const result = generateIframePreview("https://example.com", "my-question_1");

    expect(result).toContain('id="my-question_1"');
  });

  it("returns a string value", () => {
    const result = generateIframePreview("https://example.com", "test");

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
