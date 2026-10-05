import { render, screen } from "@testing-library/react";

import { CompactAnswerView } from "../CompactAnswerView";

describe("CompactAnswerView", () => {
  it("renders a dash when there is no answer", () => {
    render(<CompactAnswerView questionType="shortanswer" answer="" />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the compact formatted answer", () => {
    render(<CompactAnswerView questionType="mchoice" answer="3" />);

    expect(screen.getByText("Option D")).toBeInTheDocument();
  });
});
