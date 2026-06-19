import {
  DEFAULT_INCORRECT_FEEDBACK,
  buildQuestionJson,
  getDefaultQuestionJson,
  mergeQuestionJsonWithDefaults
} from "./questionJson";
import type { TableDropdownOption } from "@/types/dataset";
import type { CreateExerciseFormType, QuestionJSON } from "@/types/exercises";

const languageOptions: TableDropdownOption[] = [
  { value: "python", label: "Python", description: "Python language" },
  { value: "java", label: "Java", description: "Java language" }
];

const baseExercise: Omit<CreateExerciseFormType, keyof QuestionJSON> = {
  id: 1,
  assignment_id: 10,
  question_id: 100,
  points: 5,
  timed: false,
  autograde: "pct_correct",
  which_to_grade: "best_answer",
  reading_assignment: false,
  sorting_priority: 1,
  activities_required: 0,
  use_llm: false,
  qnumber: "q1",
  name: "test_question",
  subchapter: "sub",
  chapter: "ch1",
  base_course: "course",
  htmlsrc: "",
  question_type: "activecode",
  owner: "user",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Test",
  topic: "topic",
  difficulty: 1,
  author: "author",
  description: "",
  is_private: false,
  from_source: false
};

describe("buildQuestionJson", () => {
  describe("activecode question type", () => {
    it("returns JSON with activecode-specific fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "activecode",
        prefix_code: "pre",
        starter_code: "start",
        suffix_code: "suf",
        instructions: "do this",
        language: "python",
        stdin: "input",
        selectedExistingDataFiles: [],
        enableCodeTailor: true,
        parsonspersonalize: "movable",
        parsonsexample: "example",
        enableCodelens: false
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.prefix_code).toBe("pre");
      expect(result.starter_code).toBe("start");
      expect(result.suffix_code).toBe("suf");
      expect(result.instructions).toBe("do this");
      expect(result.language).toBe("python");
      expect(result.stdin).toBe("input");
      expect(result.selectedExistingDataFiles).toEqual([]);
      expect(result.enableCodeTailor).toBe(true);
      expect(result.parsonspersonalize).toBe("movable");
      expect(result.parsonsexample).toBe("example");
      expect(result.enableCodelens).toBe(false);
    });

    it("does not include fields from other question types", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "activecode",
        language: "python",
        statement: "some statement"
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.statement).toBeUndefined();
      expect(result.optionList).toBeUndefined();
      expect(result.blocks).toBeUndefined();
    });
  });

  describe("shortanswer question type", () => {
    it("returns JSON with shortanswer-specific fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "shortanswer",
        attachment: true,
        statement: "answer this"
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.attachment).toBe(true);
      expect(result.statement).toBe("answer this");
    });

    it("does not include activecode fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "shortanswer",
        attachment: false,
        statement: "test"
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.prefix_code).toBeUndefined();
      expect(result.language).toBeUndefined();
    });
  });

  describe("mchoice question type", () => {
    it("returns JSON with mchoice-specific fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "mchoice",
        statement: "which is correct?",
        optionList: [
          { choice: "A", feedback: "wrong", correct: false },
          { choice: "B", feedback: "right", correct: true }
        ]
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.statement).toBe("which is correct?");
      expect(result.optionList).toHaveLength(2);
      expect(result.optionList[1].correct).toBe(true);
    });
  });

  describe("poll question type", () => {
    it("returns JSON with poll-specific fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "poll",
        statement: "rate this",
        optionList: [{ choice: "1", feedback: "", correct: false }]
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.statement).toBe("rate this");
      expect(result.optionList).toHaveLength(1);
    });
  });

  describe("dragndrop question type", () => {
    it("returns JSON with dragndrop-specific fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "dragndrop",
        statement: "drag items",
        left: [{ id: "a", label: "left1" }],
        right: [{ id: "x", label: "right1" }],
        correctAnswers: [["a", "x"]],
        feedback: "wrong answer"
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.statement).toBe("drag items");
      expect(result.left).toEqual([{ id: "a", label: "left1" }]);
      expect(result.right).toEqual([{ id: "x", label: "right1" }]);
      expect(result.correctAnswers).toEqual([["a", "x"]]);
      expect(result.feedback).toBe("wrong answer");
    });
  });

  describe("matching question type", () => {
    it("returns JSON with matching-specific fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "matching",
        statement: "match items",
        left: [{ id: "a", label: "left1" }],
        right: [{ id: "x", label: "right1" }],
        correctAnswers: [["a", "x"]],
        feedback: "incorrect"
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.statement).toBe("match items");
      expect(result.left).toHaveLength(1);
      expect(result.right).toHaveLength(1);
      expect(result.correctAnswers).toEqual([["a", "x"]]);
      expect(result.feedback).toBe("incorrect");
    });
  });

  describe("parsonsprob question type", () => {
    it("returns JSON with parsonsprob-specific fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "parsonsprob",
        blocks: [{ id: "block-1", content: "x = 1", indent: 0 }],
        language: "python",
        instructions: "order these",
        adaptive: true,
        numbered: "left",
        noindent: false
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].content).toBe("x = 1");
      expect(result.language).toBe("python");
      expect(result.instructions).toBe("order these");
      expect(result.adaptive).toBe(true);
      expect(result.numbered).toBe("left");
      expect(result.noindent).toBe(false);
    });
  });

  describe("fillintheblank question type", () => {
    it("returns JSON with fillintheblank-specific fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "fillintheblank",
        questionText: "fill ___",
        blanks: []
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.questionText).toBe("fill ___");
      expect(result.blanks).toEqual([]);
    });
  });

  describe("selectquestion question type", () => {
    it("returns JSON with selectquestion-specific fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "selectquestion",
        questionList: ["q1", "q2"],
        questionLabels: { q1: "label1" },
        abExperimentName: "exp1",
        toggleOptions: ["opt1"],
        dataLimitBasecourse: true
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.questionList).toEqual(["q1", "q2"]);
      expect(result.questionLabels).toEqual({ q1: "label1" });
      expect(result.abExperimentName).toBe("exp1");
      expect(result.toggleOptions).toEqual(["opt1"]);
      expect(result.dataLimitBasecourse).toBe(true);
    });
  });

  describe("clickablearea question type", () => {
    it("returns JSON with clickablearea-specific fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "clickablearea",
        questionText: "click the correct area",
        statement: "statement",
        feedback: "try again"
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.questionText).toBe("click the correct area");
      expect(result.statement).toBe("statement");
      expect(result.feedback).toBe("try again");
    });
  });

  describe("iframe question type", () => {
    it("returns JSON with iframe-specific fields", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "iframe",
        iframeSrc: "https://example.com"
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result.iframeSrc).toBe("https://example.com");
    });
  });

  describe("unknown question type", () => {
    it("returns an empty JSON object when question type is unknown", () => {
      const data: CreateExerciseFormType = {
        ...baseExercise,
        question_type: "unknown_type",
        statement: "something"
      };

      const result = JSON.parse(buildQuestionJson(data));

      expect(result).toEqual({});
    });
  });

  it("always returns a valid JSON string", () => {
    const data: CreateExerciseFormType = {
      ...baseExercise,
      question_type: "mchoice",
      statement: "test",
      optionList: []
    };

    const result = buildQuestionJson(data);

    expect(typeof result).toBe("string");
    expect(() => JSON.parse(result)).not.toThrow();
  });
});

describe("getDefaultQuestionJson", () => {
  it("returns default values with the first language option selected", () => {
    const defaults = getDefaultQuestionJson(languageOptions);

    expect(defaults.language).toBe("python");
  });

  it("returns empty string defaults for text fields", () => {
    const defaults = getDefaultQuestionJson(languageOptions);

    expect(defaults.statement).toBe("");
    expect(defaults.instructions).toBe("");
    expect(defaults.prefix_code).toBe("");
    expect(defaults.starter_code).toBe("");
    expect(defaults.suffix_code).toBe("");
    expect(defaults.stdin).toBe("");
  });

  it("returns false for attachment by default", () => {
    const defaults = getDefaultQuestionJson(languageOptions);

    expect(defaults.attachment).toBe(false);
  });

  it("returns two empty options in optionList by default", () => {
    const defaults = getDefaultQuestionJson(languageOptions);

    expect(defaults.optionList).toHaveLength(2);
    expect(defaults.optionList[0]).toEqual({ choice: "", feedback: "", correct: false });
    expect(defaults.optionList[1]).toEqual({ choice: "", feedback: "", correct: false });
  });

  it("returns default left and right items", () => {
    const defaults = getDefaultQuestionJson(languageOptions);

    expect(defaults.left).toEqual([{ id: "a", label: "" }]);
    expect(defaults.right).toEqual([{ id: "x", label: "" }]);
  });

  it("returns default correct answers", () => {
    const defaults = getDefaultQuestionJson(languageOptions);

    expect(defaults.correctAnswers).toEqual([["a", "x"]]);
  });

  it("returns the shared default incorrect feedback text", () => {
    const defaults = getDefaultQuestionJson(languageOptions);

    expect(defaults.feedback).toBe(DEFAULT_INCORRECT_FEEDBACK);
    expect(DEFAULT_INCORRECT_FEEDBACK).toBe("Not quite. Try again.");
  });

  it("returns one block in blocks by default", () => {
    const defaults = getDefaultQuestionJson(languageOptions);

    expect(defaults.blocks).toHaveLength(1);
    expect(defaults.blocks[0].content).toBe("");
    expect(defaults.blocks[0].indent).toBe(0);
    expect(defaults.blocks[0].id).toMatch(/^block-\d+$/);
  });

  it("returns default parsons options", () => {
    const defaults = getDefaultQuestionJson(languageOptions);

    expect(defaults.adaptive).toBe(true);
    expect(defaults.numbered).toBe("left");
    expect(defaults.noindent).toBe(false);
  });

  it("returns default CodeTailor options", () => {
    const defaults = getDefaultQuestionJson(languageOptions);

    expect(defaults.enableCodeTailor).toBe(false);
    expect(defaults.parsonspersonalize).toBe("");
    expect(defaults.parsonsexample).toBe("");
    expect(defaults.enableCodelens).toBe(true);
  });

  it("uses the first element from language options array", () => {
    const customOptions: TableDropdownOption[] = [
      { value: "java", label: "Java", description: "Java" },
      { value: "python", label: "Python", description: "Python" }
    ];

    const defaults = getDefaultQuestionJson(customOptions);

    expect(defaults.language).toBe("java");
  });
});

describe("mergeQuestionJsonWithDefaults", () => {
  it("returns all defaults when questionJson is undefined", () => {
    const result = mergeQuestionJsonWithDefaults(languageOptions, undefined);

    expect(result.language).toBe("python");
    expect(result.statement).toBe("");
    expect(result.optionList).toHaveLength(2);
    expect(result.feedback).toBe(DEFAULT_INCORRECT_FEEDBACK);
    expect(result.adaptive).toBe(true);
    expect(result.numbered).toBe("left");
    expect(result.noindent).toBe(false);
    expect(result.enableCodeTailor).toBe(false);
    expect(result.enableCodelens).toBe(true);
    expect(result.questionLabels).toEqual({});
  });

  it("overrides defaults with provided questionJson fields", () => {
    const questionJson: QuestionJSON = {
      language: "java",
      statement: "my statement",
      feedback: "custom feedback"
    };

    const result = mergeQuestionJsonWithDefaults(languageOptions, questionJson);

    expect(result.language).toBe("java");
    expect(result.statement).toBe("my statement");
    expect(result.feedback).toBe("custom feedback");
  });

  it("preserves provided optionList when given", () => {
    const questionJson: QuestionJSON = {
      optionList: [{ choice: "A", feedback: "ok", correct: true }]
    };

    const result = mergeQuestionJsonWithDefaults(languageOptions, questionJson);

    expect(result.optionList).toHaveLength(1);
    expect(result.optionList![0].choice).toBe("A");
  });

  it("falls back to default optionList when not provided in questionJson", () => {
    const questionJson: QuestionJSON = {
      statement: "no options"
    };

    const result = mergeQuestionJsonWithDefaults(languageOptions, questionJson);

    expect(result.optionList).toHaveLength(2);
  });

  it("preserves provided left/right when given", () => {
    const questionJson: QuestionJSON = {
      left: [{ id: "b", label: "left item" }],
      right: [{ id: "y", label: "right item" }]
    };

    const result = mergeQuestionJsonWithDefaults(languageOptions, questionJson);

    expect(result.left).toEqual([{ id: "b", label: "left item" }]);
    expect(result.right).toEqual([{ id: "y", label: "right item" }]);
  });

  it("falls back to defaults for left/right when not provided", () => {
    const result = mergeQuestionJsonWithDefaults(languageOptions, {});

    expect(result.left).toEqual([{ id: "a", label: "" }]);
    expect(result.right).toEqual([{ id: "x", label: "" }]);
  });

  it("preserves provided correctAnswers when given", () => {
    const questionJson: QuestionJSON = {
      correctAnswers: [["b", "y"]]
    };

    const result = mergeQuestionJsonWithDefaults(languageOptions, questionJson);

    expect(result.correctAnswers).toEqual([["b", "y"]]);
  });

  it("preserves provided blocks when given", () => {
    const questionJson: QuestionJSON = {
      blocks: [{ id: "custom-block", content: "code here", indent: 1 }]
    };

    const result = mergeQuestionJsonWithDefaults(languageOptions, questionJson);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks![0].content).toBe("code here");
    expect(result.blocks![0].indent).toBe(1);
  });

  it("preserves parsons options when given", () => {
    const questionJson: QuestionJSON = {
      adaptive: false,
      numbered: "right",
      noindent: true
    };

    const result = mergeQuestionJsonWithDefaults(languageOptions, questionJson);

    expect(result.adaptive).toBe(false);
    expect(result.numbered).toBe("right");
    expect(result.noindent).toBe(true);
  });

  it("preserves CodeTailor options when given", () => {
    const questionJson: QuestionJSON = {
      enableCodeTailor: true,
      parsonspersonalize: "partial",
      parsonsexample: "some example",
      enableCodelens: false
    };

    const result = mergeQuestionJsonWithDefaults(languageOptions, questionJson);

    expect(result.enableCodeTailor).toBe(true);
    expect(result.parsonspersonalize).toBe("partial");
    expect(result.parsonsexample).toBe("some example");
    expect(result.enableCodelens).toBe(false);
  });

  it("always returns questionLabels as empty object when not provided", () => {
    const result = mergeQuestionJsonWithDefaults(languageOptions, { statement: "test" });

    expect(result.questionLabels).toEqual({});
  });

  it("preserves questionLabels when provided in questionJson", () => {
    const questionJson: QuestionJSON = {
      questionLabels: { q1: "Question 1", q2: "Question 2" }
    };

    const result = mergeQuestionJsonWithDefaults(languageOptions, questionJson);

    expect(result.questionLabels).toEqual({ q1: "Question 1", q2: "Question 2" });
  });

  it("merges extra fields from questionJson not explicitly handled", () => {
    const questionJson: QuestionJSON = {
      iframeSrc: "https://example.com",
      stdin: "test input"
    };

    const result = mergeQuestionJsonWithDefaults(languageOptions, questionJson);

    expect(result.iframeSrc).toBe("https://example.com");
    expect(result.stdin).toBe("test input");
  });

  it("uses default language from first language option when questionJson has no language", () => {
    const result = mergeQuestionJsonWithDefaults(languageOptions, { statement: "hello" });

    expect(result.language).toBe("python");
  });
});
