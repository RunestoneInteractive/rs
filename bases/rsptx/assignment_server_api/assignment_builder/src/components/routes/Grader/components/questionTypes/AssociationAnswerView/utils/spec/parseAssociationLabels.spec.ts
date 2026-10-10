import { parseAssociationLabels } from "../parseAssociationLabels";

describe("parseAssociationLabels", () => {
  it("extracts plain labels from JSON and legacy draggable markup", () => {
    const htmlsrc = `<div>
      <script type="application/json">{
        "left":[{"id":"left-1","label":"<strong>Loop</strong>"}],
        "right":[{"id":"right-1","label":"Repeats statements"}]
      }</script>
      <span id="legacy-item" data-subcomponent="draggable"> Legacy item </span>
    </div>`;

    expect(parseAssociationLabels(htmlsrc)).toEqual({
      "left-1": "Loop",
      "right-1": "Repeats statements",
      "legacy-item": "Legacy item"
    });
  });
});
