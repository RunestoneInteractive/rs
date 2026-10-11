import { DEFAULT_INCORRECT_FEEDBACK } from "@/utils/questionJson";

import { generateDragAndDropPreview } from "./dndPreview";

const baseLeft = [
  { id: "l1", label: "Apple" },
  { id: "l2", label: "Banana" }
];
const baseRight = [
  { id: "r1", label: "Red fruit" },
  { id: "r2", label: "Yellow fruit" }
];
const baseCorrectAnswers = [
  ["l1", "r1"],
  ["l2", "r2"]
];

describe("generateDragAndDropPreview", () => {
  it("returns a string containing the runestone wrapper div", () => {
    const result = generateDragAndDropPreview({
      left: baseLeft,
      right: baseRight,
      correctAnswers: baseCorrectAnswers,
      feedback: "Try again.",
      name: "myExercise"
    });

    expect(result).toContain('class="runestone flex justify-content-center"');
    expect(result).toContain('data-component="dragndrop"');
  });

  it("uses the sanitized name as the element id and question_label", () => {
    const result = generateDragAndDropPreview({
      left: baseLeft,
      right: baseRight,
      correctAnswers: baseCorrectAnswers,
      feedback: "Try again.",
      name: "my exercise"
    });

    expect(result).toContain('id="myexercise"');
    expect(result).toContain('data-question_label="myexercise"');
  });

  it("renders connected left items as draggable li elements", () => {
    const result = generateDragAndDropPreview({
      left: baseLeft,
      right: baseRight,
      correctAnswers: baseCorrectAnswers,
      feedback: "Try again.",
      name: "test"
    });

    expect(result).toContain('data-subcomponent="draggable"');
    expect(result).toContain("Apple");
    expect(result).toContain("Banana");
  });

  it("renders connected right items as dropzone li elements", () => {
    const result = generateDragAndDropPreview({
      left: baseLeft,
      right: baseRight,
      correctAnswers: baseCorrectAnswers,
      feedback: "Try again.",
      name: "test"
    });

    expect(result).toContain('data-subcomponent="dropzone"');
    expect(result).toContain("Red fruit");
    expect(result).toContain("Yellow fruit");
  });

  it("links draggable id to dropzone via for attribute", () => {
    const result = generateDragAndDropPreview({
      left: [{ id: "l1", label: "Cat" }],
      right: [{ id: "r1", label: "Animal" }],
      correctAnswers: [["l1", "r1"]],
      feedback: "Try again.",
      name: "linkTest"
    });

    expect(result).toContain('id="linkTest_drag_l1"');
    expect(result).toContain('for="linkTest_drag_l1"');
  });

  it("renders unmatched left items as extras with a different id prefix", () => {
    const result = generateDragAndDropPreview({
      left: [
        { id: "l1", label: "Cat" },
        { id: "l2", label: "Dog" }
      ],
      right: [{ id: "r1", label: "Animal" }],
      correctAnswers: [["l1", "r1"]],
      feedback: "Try again.",
      name: "extraTest"
    });

    expect(result).toContain('id="extraTest_extra_l2"');
    expect(result).toContain("Dog");
  });

  it("renders unmatched right items as dropzones with a placeholder for attribute", () => {
    const result = generateDragAndDropPreview({
      left: [{ id: "l1", label: "Cat" }],
      right: [
        { id: "r1", label: "Animal" },
        { id: "r2", label: "Plant" }
      ],
      correctAnswers: [["l1", "r1"]],
      feedback: "Try again.",
      name: "placeholderTest"
    });

    expect(result).toContain('for="placeholderTest_placeholder_r2"');
    expect(result).toContain("Plant");
  });

  it("uses the provided statement when supplied", () => {
    const result = generateDragAndDropPreview({
      left: baseLeft,
      right: baseRight,
      correctAnswers: baseCorrectAnswers,
      feedback: "Try again.",
      name: "stmtTest",
      statement: "Match the fruits."
    });

    expect(result).toContain("Match the fruits.");
    expect(result).not.toContain("Match items from the left column");
  });

  it("uses a default statement when statement is not provided", () => {
    const result = generateDragAndDropPreview({
      left: baseLeft,
      right: baseRight,
      correctAnswers: baseCorrectAnswers,
      feedback: "Try again.",
      name: "defaultStmt"
    });

    expect(result).toContain(
      "Match items from the left column with their corresponding items on the right."
    );
  });

  it("uses the provided feedback text", () => {
    const result = generateDragAndDropPreview({
      left: baseLeft,
      right: baseRight,
      correctAnswers: baseCorrectAnswers,
      feedback: "Wrong answer!",
      name: "fbTest"
    });

    expect(result).toContain("Wrong answer!");
  });

  it("uses a default feedback text when feedback is empty", () => {
    const result = generateDragAndDropPreview({
      left: baseLeft,
      right: baseRight,
      correctAnswers: baseCorrectAnswers,
      feedback: "",
      name: "fbDefault"
    });

    expect(result).toContain(DEFAULT_INCORRECT_FEEDBACK);
  });

  it("strips wrapping p tags from labels", () => {
    const result = generateDragAndDropPreview({
      left: [{ id: "l1", label: "<p>Wrapped</p>" }],
      right: [{ id: "r1", label: "<p>Also wrapped</p>" }],
      correctAnswers: [["l1", "r1"]],
      feedback: "Try again.",
      name: "stripTest"
    });

    expect(result).not.toContain("<p>Wrapped</p>");
    expect(result).toContain(">Wrapped<");
    expect(result).not.toContain("<p>Also wrapped</p>");
    expect(result).toContain(">Also wrapped<");
  });

  it("converts inner p tags to span tags in labels", () => {
    const result = generateDragAndDropPreview({
      left: [{ id: "l1", label: "<p>Line one<p>Line two</p></p>" }],
      right: [{ id: "r1", label: "Right item" }],
      correctAnswers: [["l1", "r1"]],
      feedback: "Try again.",
      name: "innerPTest"
    });

    expect(result).toContain("<span>");
    expect(result).toContain("</span>");
  });

  it("handles empty left and right arrays without throwing", () => {
    const result = generateDragAndDropPreview({
      left: [],
      right: [],
      correctAnswers: [],
      feedback: "Try again.",
      name: "emptyTest"
    });

    expect(result).toContain('data-component="dragndrop"');
  });

  it("handles a right item that appears in multiple correct answer pairs only once as dropzone", () => {
    const result = generateDragAndDropPreview({
      left: [
        { id: "l1", label: "Cat" },
        { id: "l2", label: "Dog" }
      ],
      right: [{ id: "r1", label: "Animal" }],
      correctAnswers: [
        ["l1", "r1"],
        ["l2", "r1"]
      ],
      feedback: "Try again.",
      name: "dedupeTest"
    });

    const dropzoneMatches = [...result.matchAll(/data-subcomponent="dropzone"/g)];

    expect(dropzoneMatches.length).toBe(1);
  });

  it("gives every premise sharing a dropzone the same category as that dropzone", () => {
    const result = generateDragAndDropPreview({
      left: [
        { id: "l1", label: "Corn" },
        { id: "l2", label: "Peas" },
        { id: "l3", label: "Pear" }
      ],
      right: [
        { id: "r1", label: "Vegetable" },
        { id: "r2", label: "Fruit" }
      ],
      correctAnswers: [
        ["l1", "r1"],
        ["l2", "r1"],
        ["l3", "r2"]
      ],
      feedback: "Try again.",
      name: "manyToOne"
    });

    expect(result).toContain(
      '<li data-subcomponent="draggable" id="manyToOne_drag_l1" data-category="manyToOne_cat_r1">Corn</li>'
    );
    expect(result).toContain(
      '<li data-subcomponent="draggable" id="manyToOne_drag_l2" data-category="manyToOne_cat_r1">Peas</li>'
    );
    expect(result).toContain(
      '<li data-subcomponent="dropzone" for="manyToOne_drag_l1" data-category="manyToOne_cat_r1">Vegetable</li>'
    );
    expect(result).toContain(
      '<li data-subcomponent="draggable" id="manyToOne_drag_l3" data-category="manyToOne_cat_r2">Pear</li>'
    );
    expect(result).toContain(
      '<li data-subcomponent="dropzone" for="manyToOne_drag_l3" data-category="manyToOne_cat_r2">Fruit</li>'
    );
  });

  it("emits a premise only once when it is linked to several dropzones", () => {
    const result = generateDragAndDropPreview({
      left: [{ id: "l1", label: "Cat" }],
      right: [
        { id: "r1", label: "Animal" },
        { id: "r2", label: "Pet" }
      ],
      correctAnswers: [
        ["l1", "r1"],
        ["l1", "r2"]
      ],
      feedback: "Try again.",
      name: "multiLink"
    });

    const draggableMatches = [...result.matchAll(/data-subcomponent="draggable"/g)];

    expect(draggableMatches.length).toBe(1);
  });

  it("gives each unmatched right item its own placeholder id", () => {
    const result = generateDragAndDropPreview({
      left: [],
      right: [
        { id: "r1", label: "Animal" },
        { id: "r2", label: "Plant" }
      ],
      correctAnswers: [],
      feedback: "Try again.",
      name: "twoPlaceholders"
    });

    expect(result).toContain('for="twoPlaceholders_placeholder_r1"');
    expect(result).toContain('for="twoPlaceholders_placeholder_r2"');
  });

  it("generates a valid fallback id when name contains only special characters", () => {
    const result = generateDragAndDropPreview({
      left: [],
      right: [],
      correctAnswers: [],
      feedback: "Try again.",
      name: "!@#"
    });

    expect(result).toMatch(/id="[a-zA-Z][a-zA-Z0-9_-]*"/);
  });

  it("renders labels with empty string when label is falsy", () => {
    const result = generateDragAndDropPreview({
      left: [{ id: "l1", label: "" }],
      right: [{ id: "r1", label: "" }],
      correctAnswers: [["l1", "r1"]],
      feedback: "Try again.",
      name: "emptyLabel"
    });

    expect(result).toContain('data-subcomponent="draggable"');
    expect(result).toContain('data-subcomponent="dropzone"');
  });
});

describe("generateDragAndDropPreview with feedback on cards", () => {
  const parseJson = (html: string) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const script = doc.querySelector('[data-component="dragndrop"] script');

    expect(script?.getAttribute("type")).toBe("application/json");

    return JSON.parse(script?.textContent || "");
  };

  it("writes a JSON script block that keeps each card's feedback", () => {
    const result = generateDragAndDropPreview({
      left: [baseLeft[0], { ...baseLeft[1], feedback: "<p>Bananas are yellow.</p>" }],
      right: [{ ...baseRight[0], feedback: "Only red fruit." }, baseRight[1]],
      correctAnswers: baseCorrectAnswers,
      feedback: "Try again.",
      name: "cards",
      statement: "Sort the fruit."
    });

    expect(result).toContain('id="cards"');
    expect(result).not.toContain("data-subcomponent");
    expect(parseJson(result)).toEqual({
      statement: "Sort the fruit.",
      feedback: "Try again.",
      left: [
        { id: "cards_l1", label: "Apple" },
        { id: "cards_l2", label: "Banana", feedback: "<p>Bananas are yellow.</p>" }
      ],
      right: [
        { id: "cards_r1", label: "Red fruit", feedback: "Only red fruit." },
        { id: "cards_r2", label: "Yellow fruit" }
      ],
      correctAnswers: [
        ["cards_l1", "cards_r1"],
        ["cards_l2", "cards_r2"]
      ]
    });
  });

  it("escapes closing tags so the script element is not cut short", () => {
    const result = generateDragAndDropPreview({
      left: [{ ...baseLeft[0], feedback: "</script><b>x</b>" }],
      right: baseRight,
      correctAnswers: [["l1", "r1"]],
      feedback: "",
      name: "cards"
    });

    expect(result).not.toContain("</script><b>");
    expect(parseJson(result).left[0].feedback).toBe("</script><b>x</b>");
  });
});
