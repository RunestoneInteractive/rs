import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { AnswerRendererProps } from "../../types";
import { AssociationAnswerView } from "../AssociationAnswerView";
import { formatAssociationAnswer, parseAssociations } from "../utils";

const baseProps = (overrides: Partial<AnswerRendererProps> = {}): AnswerRendererProps => ({
  answer: "",
  history: [],
  questionName: "q-div-1",
  questionId: 7,
  sid: "student1",
  ...overrides
});

describe("AssociationAnswerView", () => {
  it("renders matching connections as readable pairs", () => {
    renderWithMantine(
      <AssociationAnswerView
        {...baseProps({ answer: '{"connections":[{"from":"left-1","to":"right-2"}]}' })}
        kind="matching"
      />
    );

    expect(screen.getByText("Submitted matches")).toBeInTheDocument();
    expect(screen.getByText("left-1 → right-2")).toBeInTheDocument();
  });

  it("renders drag-and-drop placements grouped by dropzone", () => {
    renderWithMantine(
      <AssociationAnswerView
        {...baseProps({ answer: '{"zone-1":["item-a","item-b"]}' })}
        kind="dragndrop"
      />
    );

    expect(screen.getByText("Submitted placements")).toBeInTheDocument();
    expect(screen.getByText("item-a → zone-1")).toBeInTheDocument();
    expect(screen.getByText("item-b → zone-1")).toBeInTheDocument();
  });

  it("replaces matching ids with labels from the rendered question", () => {
    const htmlsrc = `<div data-component="matching"><script type="application/json">{
      "left":[{"id":"p1","label":"Loop"}],
      "right":[{"id":"r1","label":"Repeats <strong>statements</strong>"}]
    }</script></div>`;

    renderWithMantine(
      <AssociationAnswerView
        {...baseProps({
          answer: '{"connections":[{"from":"p1","to":"r1"}]}',
          htmlsrc
        })}
        kind="matching"
      />
    );

    expect(screen.getByText("Loop → Repeats statements")).toBeInTheDocument();
  });

  it("formats drag-and-drop history without exposing its JSON", () => {
    const htmlsrc = `<ul data-component="dragndrop"><script type="application/json">{
      "left":[{"id":"p1","label":"Apple"}],
      "right":[{"id":"r1","label":"Red"}]
    }</script></ul>`;

    expect(formatAssociationAnswer("dragndrop", '{"r1":["p1"]}', htmlsrc)).toBe("Apple → Red");
  });

  it("rejects malformed stored mappings without throwing", () => {
    expect(parseAssociations("matching", "not-json")).toEqual([]);
    renderWithMantine(
      <AssociationAnswerView {...baseProps({ answer: "not-json" })} kind="matching" />
    );

    expect(screen.getByText("Stored answer could not be decoded.")).toBeInTheDocument();
  });
});
