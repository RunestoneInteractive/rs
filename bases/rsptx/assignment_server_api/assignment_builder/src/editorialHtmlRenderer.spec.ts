import { describe, expect, it } from "vitest";

import { regenerateEditorialQuestionHtml } from "./editorialHtmlRenderer";

describe("regenerateEditorialQuestionHtml", () => {
  it("uses the Assignment Builder renderer for a supported question type", () => {
    const html = regenerateEditorialQuestionHtml({
      name: "editorial-short-answer",
      questionType: "shortanswer",
      questionJson: {
        statement: "What is the updated answer?",
        attachment: false
      },
      currentHtml: "<p>Old question</p>"
    });

    expect(html).toContain('data-component="shortanswer"');
    expect(html).toContain("id=editorial-short-answer");
    expect(html).toContain("What is the updated answer?");
    expect(html).not.toContain("Old question");
  });

  it("preserves current HTML for a type the renderer does not support", () => {
    const html = regenerateEditorialQuestionHtml({
      name: "unsupported-question",
      questionType: "unsupported",
      questionJson: { statement: "Updated" },
      currentHtml: '<div id="unsupported-question">Existing HTML</div>'
    });

    expect(html).toBe('<div id="unsupported-question">Existing HTML</div>');
  });
});
