import { formatAssociationAnswer } from "../formatAssociationAnswer";

describe("formatAssociationAnswer", () => {
  it("falls back to ids when the question has no matching label", () => {
    expect(
      formatAssociationAnswer(
        "matching",
        '{"connections":[{"from":"known","to":"unknown"}]}',
        '<span id="known" data-subcomponent="draggable">Known label</span>'
      )
    ).toBe("Known label → unknown");
  });
});
