import { generateParsonsPreview } from "./parsonsPreview";

const blocksOf = (html: string): string => {
  const pre = new DOMParser()
    .parseFromString(html, "text/html")
    .querySelector("pre.parsonsblocks") as HTMLElement;

  return pre.innerHTML.trim();
};

describe("generateParsonsPreview", () => {
  it("indents every line of a block by the block's indent", () => {
    const html = generateParsonsPreview({
      instructions: "Order it.",
      name: "p",
      blocks: [
        { id: "a", content: "while True:", indent: 0 },
        { id: "b", content: "print(1)", indent: 1 },
        { id: "c", content: "if x:\n    y = 2", indent: 1 }
      ]
    });

    expect(blocksOf(html)).toBe("while True:\n---\n    print(1)\n---\n    if x:\n        y = 2");
  });

  it("writes the hidden program a solved runnable parsons runs", () => {
    const html = generateParsonsPreview({
      instructions: "Order it.",
      name: "p",
      language: "cpp",
      blocks: [{ id: "a", content: "int x = 1;", indent: 0 }],
      runnable: true,
      runnableCode: "#include <vector>\n==PARSONSCODE==\nif (a && b) {}",
      runnableOptions: {
        language: "cpp",
        enableCodelens: true,
        compileArgs: "['-Wall']",
        selectedExistingDataFiles: ["data.txt"]
      }
    });
    const doc = new DOMParser().parseFromString(html, "text/html");
    const holder = doc.getElementById("p-runnable") as HTMLElement;
    const textarea = holder.querySelector(
      '[data-component="parsons-runnable"] textarea'
    ) as HTMLTextAreaElement;

    expect(doc.querySelector("pre")?.getAttribute("data-runnable")).toBe("true");
    expect(holder.style.display).toBe("none");
    // escaped in the HTML, so the program reads back exactly
    expect(textarea.value).toBe("#include <vector>\n==PARSONSCODE==\nif (a && b) {}");
    expect(textarea.dataset.lang).toBe("cpp");
    expect(textarea.dataset.codelens).toBe("true");
    expect(textarea.dataset.compileargs).toBe("['-Wall']");
    expect(textarea.dataset.datafile).toBe("data.txt");
  });

  it("writes no runnable program unless asked", () => {
    const html = generateParsonsPreview({ instructions: "", name: "p", blocks: [] });

    expect(html).not.toContain("data-runnable");
    expect(html).not.toContain("parsons-runnable");
  });

  it("writes data-adaptive with the DAG grader too", () => {
    const html = generateParsonsPreview({
      instructions: "",
      name: "p",
      blocks: [{ id: "a", content: "x = 1", indent: 0, tag: "x" }],
      grader: "dag",
      adaptive: true
    });

    expect(html).toContain('data-grader="dag"');
    expect(html).toContain('data-adaptive="true"');
  });
});
