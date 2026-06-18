import { generateActiveCodePreview } from "./activeCode";

const BASE_ARGS = {
  instructions: "Write a function.",
  language: "python",
  prefix_code: "# prefix",
  starter_code: "pass",
  suffix_code: "# suffix",
  name: "my-exercise"
};

function call(
  overrides: Partial<
    Parameters<typeof generateActiveCodePreview>[8] extends infer T
      ? Record<string, unknown>
      : Record<string, unknown>
  > = {},
  extra?: {
    stdin?: string;
    selectedDataFiles?: { acid: string; filename?: string }[];
    codeTailorOptions?: Parameters<typeof generateActiveCodePreview>[8];
  }
): string {
  return generateActiveCodePreview(
    BASE_ARGS.instructions,
    BASE_ARGS.language,
    BASE_ARGS.prefix_code,
    BASE_ARGS.starter_code,
    BASE_ARGS.suffix_code,
    BASE_ARGS.name,
    extra?.stdin,
    extra?.selectedDataFiles,
    extra?.codeTailorOptions
  );
}

describe("generateActiveCodePreview", () => {
  describe("basic structure", () => {
    it("returns HTML containing the runestone activecode wrapper", () => {
      const html = call();
      expect(html).toContain('class="runestone explainer ac_section ');
      expect(html).toContain('data-component="activecode"');
    });

    it("embeds the sanitized name as the element id", () => {
      const html = call();
      expect(html).toContain('id="my-exercise"');
    });

    it("embeds the original name as the data-question_label", () => {
      const html = call();
      expect(html).toContain('data-question_label="my-exercise"');
    });

    it("renders the instructions inside the question div", () => {
      const html = call();
      expect(html).toContain("<p>Write a function.</p>");
    });

    it("sets the data-lang attribute to the provided language", () => {
      const html = call();
      expect(html).toContain('data-lang="python"');
    });

    it("includes prefix, starter, and suffix code separated by the expected delimiters", () => {
      const html = call();
      expect(html).toContain("# prefix");
      expect(html).toContain("^^^^");
      expect(html).toContain("pass");
      expect(html).toContain("====");
      expect(html).toContain("# suffix");
    });
  });

  describe("name sanitization", () => {
    it("strips special characters from the name when used as id", () => {
      const html = generateActiveCodePreview("Instructions", "python", "", "", "", "hello world!");
      expect(html).toContain('id="helloworld"');
    });

    it("prepends id_ when name starts with a digit", () => {
      const html = generateActiveCodePreview("Instructions", "python", "", "", "", "123abc");
      expect(html).toContain('id="id_123abc"');
    });
  });

  describe("codelens attribute", () => {
    it("defaults to data-codelens=true when no options are provided", () => {
      const html = call();
      expect(html).toContain('data-codelens="true"');
    });

    it("sets data-codelens=true when enableCodelens is true", () => {
      const html = call({}, { codeTailorOptions: { enableCodelens: true } });
      expect(html).toContain('data-codelens="true"');
    });

    it("sets data-codelens=false when enableCodelens is false", () => {
      const html = call({}, { codeTailorOptions: { enableCodelens: false } });
      expect(html).toContain('data-codelens="false"');
    });
  });

  describe("stdin attribute", () => {
    it("does not include data-stdin when stdin is undefined", () => {
      const html = call();
      expect(html).not.toContain("data-stdin");
    });

    it("does not include data-stdin when stdin is an empty string", () => {
      const html = call({}, { stdin: "" });
      expect(html).not.toContain("data-stdin");
    });

    it("does not include data-stdin when stdin is whitespace only", () => {
      const html = call({}, { stdin: "   " });
      expect(html).not.toContain("data-stdin");
    });

    it("includes data-stdin with the provided value when stdin has content", () => {
      const html = call({}, { stdin: "hello input" });
      expect(html).toContain('data-stdin="hello input"');
    });
  });

  describe("data file attribute", () => {
    it("does not include data-datafile when selectedDataFiles is undefined", () => {
      const html = call();
      expect(html).not.toContain("data-datafile");
    });

    it("does not include data-datafile when selectedDataFiles is empty", () => {
      const html = call({}, { selectedDataFiles: [] });
      expect(html).not.toContain("data-datafile");
    });

    it("includes a single acid in data-datafile", () => {
      const html = call({}, { selectedDataFiles: [{ acid: "file1.csv" }] });
      expect(html).toContain('data-datafile="file1.csv"');
    });

    it("joins multiple acids with commas in data-datafile", () => {
      const html = call(
        {},
        {
          selectedDataFiles: [{ acid: "file1.csv" }, { acid: "file2.csv" }, { acid: "file3.csv" }]
        }
      );
      expect(html).toContain('data-datafile="file1.csv,file2.csv,file3.csv"');
    });
  });

  describe("CodeTailor attributes", () => {
    it("does not include parsonspersonalize when enableCodeTailor is false", () => {
      const html = call(
        {},
        {
          codeTailorOptions: {
            enableCodeTailor: false,
            parsonspersonalize: "movable"
          }
        }
      );
      expect(html).not.toContain("data-parsonspersonalize");
      expect(html).not.toContain("data-parsonsexample");
    });

    it("does not include parsonspersonalize when parsonspersonalize is empty string", () => {
      const html = call(
        {},
        {
          codeTailorOptions: {
            enableCodeTailor: true,
            parsonspersonalize: ""
          }
        }
      );
      expect(html).not.toContain("data-parsonspersonalize");
    });

    it("includes parsonspersonalize and defaults parsonsexample to LLM-example", () => {
      const html = call(
        {},
        {
          codeTailorOptions: {
            enableCodeTailor: true,
            parsonspersonalize: "movable"
          }
        }
      );
      expect(html).toContain('data-parsonspersonalize="movable"');
      expect(html).toContain('data-parsonsexample="LLM-example"');
    });

    it("uses provided parsonsexample value when set", () => {
      const html = call(
        {},
        {
          codeTailorOptions: {
            enableCodeTailor: true,
            parsonspersonalize: "partial",
            parsonsexample: "my-example"
          }
        }
      );
      expect(html).toContain('data-parsonspersonalize="partial"');
      expect(html).toContain('data-parsonsexample="my-example"');
    });

    it("falls back to LLM-example when parsonsexample is whitespace only", () => {
      const html = call(
        {},
        {
          codeTailorOptions: {
            enableCodeTailor: true,
            parsonspersonalize: "movable",
            parsonsexample: "   "
          }
        }
      );
      expect(html).toContain('data-parsonsexample="LLM-example"');
    });
  });
});
