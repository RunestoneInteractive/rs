import { regenerateHtmlSrc } from "./htmlRegeneration";
import { Exercise } from "@/types/exercises";
import * as multiChoice from "@/utils/preview/multichoice";
import * as fillInTheBlank from "@/utils/preview/fillInTheBlank";
import * as parsonsPreview from "@/utils/preview/parsonsPreview";
import * as activeCode from "@/utils/preview/activeCode";
import * as shortAnswer from "@/utils/preview/shortAnswer";
import * as matchingPreview from "@/utils/preview/matchingPreview";
import * as dndPreview from "@/utils/preview/dndPreview";
import * as poll from "@/utils/preview/poll";
import * as iframePreview from "@/utils/preview/iframePreview";

const baseExercise: Exercise = {
  id: 1,
  assignment_id: 1,
  question_id: 1,
  points: 1,
  timed: false,
  autograde: "all_or_nothing",
  which_to_grade: "best_answer",
  reading_assignment: false,
  sorting_priority: 0,
  activities_required: 0,
  use_llm: false,
  qnumber: "q1",
  name: "old_name",
  subchapter: "sub",
  chapter: "ch",
  base_course: "course",
  htmlsrc: "",
  question_type: "mchoice",
  question_json: "",
  owner: "owner",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Title",
  topic: "topic",
  difficulty: 1,
  author: "author",
  description: "",
  is_private: false,
  from_source: false
};

describe("regenerateHtmlSrc", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("mchoice question type", () => {
    it("calls generateMultiChoicePreview with data from question_json and new name", () => {
      const spy = vi.spyOn(multiChoice, "generateMultiChoicePreview").mockReturnValue("<mc />");
      const qJson = {
        statement: "What is 2+2?",
        optionList: [{ choice: "4", correct: true }],
        forceCheckboxes: true
      };
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "mchoice",
        question_json: JSON.stringify(qJson)
      };

      const result = regenerateHtmlSrc(exercise, "new_name");

      expect(spy).toHaveBeenCalledWith("What is 2+2?", qJson.optionList, "new_name", true);
      expect(result).toBe("<mc />");
    });

    it("falls back to empty string and empty array when question_json fields are missing", () => {
      const spy = vi.spyOn(multiChoice, "generateMultiChoicePreview").mockReturnValue("<mc />");
      const exercise: Exercise = { ...baseExercise, question_type: "mchoice", question_json: "{}" };

      regenerateHtmlSrc(exercise, "new_name");

      expect(spy).toHaveBeenCalledWith("", [], "new_name", undefined);
    });

    it("uses empty QuestionJSON when question_json is absent", () => {
      const spy = vi.spyOn(multiChoice, "generateMultiChoicePreview").mockReturnValue("<mc />");
      const exercise: Exercise = { ...baseExercise, question_type: "mchoice", question_json: "" };

      regenerateHtmlSrc(exercise, "new_name");

      expect(spy).toHaveBeenCalledWith("", [], "new_name", undefined);
    });
  });

  describe("fillintheblank question type", () => {
    it("calls generateFillInTheBlankPreview with data from question_json and new name", () => {
      const spy = vi
        .spyOn(fillInTheBlank, "generateFillInTheBlankPreview")
        .mockReturnValue("<fitb />");
      const qJson = { questionText: "Fill ___", blanks: [{ answer: "blank" }] };
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "fillintheblank",
        question_json: JSON.stringify(qJson)
      };

      const result = regenerateHtmlSrc(exercise, "fitb_name");

      expect(spy).toHaveBeenCalledWith({
        questionText: "Fill ___",
        blanks: qJson.blanks,
        name: "fitb_name"
      });
      expect(result).toBe("<fitb />");
    });
  });

  describe("parsonsprob question type", () => {
    it("calls generateParsonsPreview with defaults when fields are absent", () => {
      const spy = vi.spyOn(parsonsPreview, "generateParsonsPreview").mockReturnValue("<parsons />");
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "parsonsprob",
        question_json: "{}"
      };

      regenerateHtmlSrc(exercise, "p_name");

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: "",
          blocks: [],
          name: "p_name",
          language: "python",
          adaptive: true,
          numbered: "left",
          noindent: false,
          questionLabel: "p_name"
        })
      );
    });

    it("uses instructions field over questionText when both present", () => {
      const spy = vi.spyOn(parsonsPreview, "generateParsonsPreview").mockReturnValue("<parsons />");
      const qJson = { instructions: "Sort these", questionText: "fallback" };
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "parsonsprob",
        question_json: JSON.stringify(qJson)
      };

      regenerateHtmlSrc(exercise, "p_name");

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ instructions: "Sort these" }));
    });

    it("falls back to questionText when instructions is absent", () => {
      const spy = vi.spyOn(parsonsPreview, "generateParsonsPreview").mockReturnValue("<parsons />");
      const qJson = { questionText: "fallback text" };
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "parsonsprob",
        question_json: JSON.stringify(qJson)
      };

      regenerateHtmlSrc(exercise, "p_name");

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ instructions: "fallback text" }));
    });
  });

  describe("activecode question type", () => {
    it("calls generateActiveCodePreview with data from question_json and new name", () => {
      const spy = vi.spyOn(activeCode, "generateActiveCodePreview").mockReturnValue("<ac />");
      const qJson = {
        instructions: "Write code",
        language: "java",
        prefix_code: "prefix",
        starter_code: "starter",
        suffix_code: "suffix",
        stdin: "input"
      };
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "activecode",
        question_json: JSON.stringify(qJson)
      };

      const result = regenerateHtmlSrc(exercise, "ac_name");

      expect(spy).toHaveBeenCalledWith(
        "Write code",
        "java",
        "prefix",
        "starter",
        "suffix",
        "ac_name",
        "input"
      );
      expect(result).toBe("<ac />");
    });

    it("uses empty strings and python as defaults when activecode fields are absent", () => {
      const spy = vi.spyOn(activeCode, "generateActiveCodePreview").mockReturnValue("<ac />");
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "activecode",
        question_json: "{}"
      };

      regenerateHtmlSrc(exercise, "ac_name");

      expect(spy).toHaveBeenCalledWith("", "python", "", "", "", "ac_name", undefined);
    });
  });

  describe("shortanswer question type", () => {
    it("calls generateShortAnswerPreview with data from question_json", () => {
      const spy = vi.spyOn(shortAnswer, "generateShortAnswerPreview").mockReturnValue("<sa />");
      const qJson = { questionText: "Explain X", attachment: true };
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "shortanswer",
        question_json: JSON.stringify(qJson)
      };

      const result = regenerateHtmlSrc(exercise, "sa_name");

      expect(spy).toHaveBeenCalledWith("Explain X", true, "sa_name");
      expect(result).toBe("<sa />");
    });

    it("defaults attachment to false when not specified", () => {
      const spy = vi.spyOn(shortAnswer, "generateShortAnswerPreview").mockReturnValue("<sa />");
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "shortanswer",
        question_json: "{}"
      };

      regenerateHtmlSrc(exercise, "sa_name");

      expect(spy).toHaveBeenCalledWith("", false, "sa_name");
    });
  });

  describe("matching question type", () => {
    it("calls generateMatchingPreview with data from question_json", () => {
      const spy = vi.spyOn(matchingPreview, "generateMatchingPreview").mockReturnValue("<match />");
      const qJson = {
        left: [{ id: "l1", label: "Left 1" }],
        right: [{ id: "r1", label: "Right 1" }],
        correctAnswers: [["l1", "r1"]],
        feedback: "Good",
        statement: "Match these"
      };
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "matching",
        question_json: JSON.stringify(qJson)
      };

      const result = regenerateHtmlSrc(exercise, "match_name");

      expect(spy).toHaveBeenCalledWith({
        left: qJson.left,
        right: qJson.right,
        correctAnswers: qJson.correctAnswers,
        feedback: "Good",
        name: "match_name",
        statement: "Match these"
      });
      expect(result).toBe("<match />");
    });

    it("falls back to questionText as statement when statement is absent", () => {
      const spy = vi.spyOn(matchingPreview, "generateMatchingPreview").mockReturnValue("<match />");
      const qJson = { questionText: "fallback statement" };
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "matching",
        question_json: JSON.stringify(qJson)
      };

      regenerateHtmlSrc(exercise, "match_name");

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ statement: "fallback statement" })
      );
    });
  });

  describe("dragndrop question type", () => {
    it("calls generateDragAndDropPreview with data from question_json", () => {
      const spy = vi.spyOn(dndPreview, "generateDragAndDropPreview").mockReturnValue("<dnd />");
      const qJson = {
        left: [{ id: "l1", label: "Drag" }],
        right: [{ id: "r1", label: "Drop" }],
        correctAnswers: [["l1", "r1"]],
        feedback: "ok",
        statement: "Drag and drop"
      };
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "dragndrop",
        question_json: JSON.stringify(qJson)
      };

      const result = regenerateHtmlSrc(exercise, "dnd_name");

      expect(spy).toHaveBeenCalledWith({
        left: qJson.left,
        right: qJson.right,
        correctAnswers: qJson.correctAnswers,
        feedback: "ok",
        name: "dnd_name",
        statement: "Drag and drop"
      });
      expect(result).toBe("<dnd />");
    });
  });

  describe("poll question type", () => {
    it("calls generatePollPreview with option choices and new name", () => {
      const spy = vi.spyOn(poll, "generatePollPreview").mockReturnValue("<poll />");
      const qJson = {
        questionText: "Vote?",
        optionList: [{ choice: "Yes" }, { choice: "No" }],
        poll_type: "options"
      };
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "poll",
        question_json: JSON.stringify(qJson)
      };

      const result = regenerateHtmlSrc(exercise, "poll_name");

      expect(spy).toHaveBeenCalledWith("Vote?", ["Yes", "No"], "poll_name", "options");
      expect(result).toBe("<poll />");
    });

    it("passes empty options array when optionList is absent", () => {
      const spy = vi.spyOn(poll, "generatePollPreview").mockReturnValue("<poll />");
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "poll",
        question_json: "{}"
      };

      regenerateHtmlSrc(exercise, "poll_name");

      expect(spy).toHaveBeenCalledWith("", [], "poll_name", undefined);
    });
  });

  describe("iframe question type", () => {
    it("calls generateIframePreview with iframeSrc and new name", () => {
      const spy = vi.spyOn(iframePreview, "generateIframePreview").mockReturnValue("<iframe />");
      const qJson = { iframeSrc: "https://example.com" };
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "iframe",
        question_json: JSON.stringify(qJson)
      };

      const result = regenerateHtmlSrc(exercise, "iframe_name");

      expect(spy).toHaveBeenCalledWith("https://example.com", "iframe_name");
      expect(result).toBe("<iframe />");
    });

    it("passes empty string when iframeSrc is absent", () => {
      const spy = vi.spyOn(iframePreview, "generateIframePreview").mockReturnValue("<iframe />");
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "iframe",
        question_json: "{}"
      };

      regenerateHtmlSrc(exercise, "iframe_name");

      expect(spy).toHaveBeenCalledWith("", "iframe_name");
    });
  });

  describe("unsupported question type (default case)", () => {
    it("replaces id, data-component, data-question, and name attributes in existing HTML", () => {
      const htmlSrc = `<div id="old_name" data-component="old_name" data-question="old_name" name="old_name" name='old_name'></div>`;
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "clickablearea",
        question_json: "{}",
        htmlsrc: htmlSrc,
        name: "old_name"
      };

      const result = regenerateHtmlSrc(exercise, "new_name");

      expect(result).toContain(`id="new_name"`);
      expect(result).toContain(`data-component="new_name"`);
      expect(result).toContain(`data-question="new_name"`);
      expect(result).not.toContain(`id="old_name"`);
    });

    it("replaces multiple occurrences of old name in HTML", () => {
      const htmlSrc = `<div id="old_name"></div><span id="old_name"></span>`;
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "selectquestion",
        question_json: "{}",
        htmlsrc: htmlSrc,
        name: "old_name"
      };

      const result = regenerateHtmlSrc(exercise, "new_name");

      expect(result).toBe(`<div id="new_name"></div><span id="new_name"></span>`);
    });

    it("returns original htmlsrc when oldName is empty", () => {
      const htmlSrc = `<div id="old_name"></div>`;
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "selectquestion",
        question_json: "{}",
        htmlsrc: htmlSrc,
        name: ""
      };

      const result = regenerateHtmlSrc(exercise, "new_name");

      expect(result).toBe(htmlSrc);
    });

    it("returns original htmlsrc when newName is empty", () => {
      const htmlSrc = `<div id="old_name"></div>`;
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "selectquestion",
        question_json: "{}",
        htmlsrc: htmlSrc,
        name: "old_name"
      };

      const result = regenerateHtmlSrc(exercise, "");

      expect(result).toBe(htmlSrc);
    });
  });

  describe("error handling", () => {
    it("falls back to updateNameInHtml when preview generator throws", () => {
      vi.spyOn(multiChoice, "generateMultiChoicePreview").mockImplementation(() => {
        throw new Error("preview error");
      });
      const htmlSrc = `<div id="old_name"></div>`;
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "mchoice",
        question_json: "{}",
        htmlsrc: htmlSrc,
        name: "old_name"
      };

      const result = regenerateHtmlSrc(exercise, "new_name");

      expect(result).toContain(`id="new_name"`);
    });

    it("falls back to updateNameInHtml when question_json is invalid JSON", () => {
      const htmlSrc = `<div id="old_name"></div>`;
      const exercise: Exercise = {
        ...baseExercise,
        question_type: "mchoice",
        question_json: "not valid json",
        htmlsrc: htmlSrc,
        name: "old_name"
      };

      const result = regenerateHtmlSrc(exercise, "new_name");

      expect(result).toContain(`id="new_name"`);
    });
  });
});
