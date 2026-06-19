import { generateSelectQuestionPreview } from "./selectQuestionPreview";

describe("generateSelectQuestionPreview", () => {
  describe("when called with a list of string question IDs", () => {
    it("returns HTML containing the question IDs in data-questionlist", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: ["q1", "q2", "q3"]
      });

      expect(result).toContain("data-questionlist='q1, q2, q3'");
    });

    it("returns HTML with the runestone sqcontainer wrapper", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: ["q1"]
      });

      expect(result).toContain('class="runestone sqcontainer"');
      expect(result).toContain('data-component="selectquestion"');
    });

    it("uses sanitized name as the element id", () => {
      const result = generateSelectQuestionPreview({
        name: "my-question_1",
        questionList: ["q1"]
      });

      expect(result).toContain('id="my-question_1"');
    });

    it("sanitizes name by removing invalid characters", () => {
      const result = generateSelectQuestionPreview({
        name: "my question!@#",
        questionList: ["q1"]
      });

      expect(result).toContain('id="myquestion"');
    });

    it("prefixes id with id_ when sanitized name does not start with a letter", () => {
      const result = generateSelectQuestionPreview({
        name: "123abc",
        questionList: ["q1"]
      });

      expect(result).toContain('id="id_123abc"');
    });

    it("displays question IDs in the loading paragraph", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: ["q1", "q2"]
      });

      expect(result).toContain("Selecting from: q1, q2");
    });

    it("does not include data-ab attribute when abExperimentName is not provided", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: ["q1"]
      });

      expect(result).not.toContain("data-ab");
    });

    it("does not include data-toggleoptions attribute when toggleOptions is not provided", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: ["q1"]
      });

      expect(result).not.toContain("data-toggleoptions");
      expect(result).not.toContain("data-togglelabels");
    });

    it("does not include data-limit-basecourse when dataLimitBasecourse is false", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: ["q1"],
        dataLimitBasecourse: false
      });

      expect(result).not.toContain("data-limit-basecourse");
    });
  });

  describe("when called with abExperimentName", () => {
    it("includes data-ab attribute with the experiment name", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: ["q1", "q2"],
        abExperimentName: "experiment-A"
      });

      expect(result).toContain('data-ab="experiment-A"');
    });
  });

  describe("when called with toggleOptions", () => {
    it("includes data-toggleoptions attribute with comma-joined options", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: ["q1", "q2"],
        toggleOptions: ["opt1", "opt2"]
      });

      expect(result).toContain('data-toggleoptions="opt1, opt2"');
    });

    it("includes data-togglelabels using question IDs when labels are absent", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: ["q1", "q2"],
        toggleOptions: ["opt1"]
      });

      expect(result).toContain('data-togglelabels="togglelabels: q1, q2"');
    });

    it("does not add toggleoptions attributes when toggleOptions is an empty array", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: ["q1"],
        toggleOptions: []
      });

      expect(result).not.toContain("data-toggleoptions");
      expect(result).not.toContain("data-togglelabels");
    });
  });

  describe("when called with dataLimitBasecourse true", () => {
    it("includes data-limit-basecourse=true attribute", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: ["q1"],
        dataLimitBasecourse: true
      });

      expect(result).toContain("data-limit-basecourse=true");
    });
  });

  describe("when called with QuestionWithLabel objects", () => {
    it("uses questionId for data-questionlist", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: [
          { questionId: "q1", label: "Question One" },
          { questionId: "q2", label: "Question Two" }
        ]
      });

      expect(result).toContain("data-questionlist='q1, q2'");
    });

    it("displays label alongside questionId in the loading paragraph when label is present", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: [{ questionId: "q1", label: "Question One" }, { questionId: "q2" }]
      });

      expect(result).toContain("Selecting from: q1 (Question One), q2");
    });

    it("uses labels in data-togglelabels when labels are provided", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: [
          { questionId: "q1", label: "Label A" },
          { questionId: "q2", label: "Label B" }
        ],
        toggleOptions: ["opt1"]
      });

      expect(result).toContain('data-togglelabels="togglelabels: Label A, Label B"');
    });

    it("falls back to questionId in data-togglelabels when label is absent", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: [{ questionId: "q1" }, { questionId: "q2", label: "Label B" }],
        toggleOptions: ["opt1"]
      });

      expect(result).toContain('data-togglelabels="togglelabels: q1, Label B"');
    });
  });

  describe("when questionList is an empty array", () => {
    it("produces empty data-questionlist and Selecting from: empty string", () => {
      const result = generateSelectQuestionPreview({
        name: "myQuestion",
        questionList: []
      });

      expect(result).toContain("data-questionlist=''");
      expect(result).toContain("Selecting from: ");
    });
  });

  describe("when all optional parameters are provided together", () => {
    it("produces HTML containing all expected attributes", () => {
      const result = generateSelectQuestionPreview({
        name: "fullTest",
        questionList: [{ questionId: "q1", label: "Q1 Label" }],
        abExperimentName: "exp1",
        toggleOptions: ["toggle1"],
        dataLimitBasecourse: true
      });

      expect(result).toContain('id="fullTest"');
      expect(result).toContain("data-questionlist='q1'");
      expect(result).toContain('data-ab="exp1"');
      expect(result).toContain('data-toggleoptions="toggle1"');
      expect(result).toContain('data-togglelabels="togglelabels: Q1 Label"');
      expect(result).toContain("data-limit-basecourse=true");
      expect(result).toContain("Selecting from: q1 (Q1 Label)");
    });
  });
});
