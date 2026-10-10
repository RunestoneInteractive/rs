import { renderRunestoneComponent } from "@/componentFuncs";
import { renderWithMantine, screen, waitFor } from "@/test/renderWithMantine";

import { QuestionPreviewHeader, RunestonePreview } from "../RunestonePreview";

vi.mock("@/componentFuncs", () => ({
  renderRunestoneComponent: vi.fn(() => Promise.resolve())
}));

vi.mock("@components/routes/AssignmentBuilder/MathJaxWrapper", () => ({
  MathJaxWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("better-react-mathjax", () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

const renderRunestoneComponentMock = vi.mocked(renderRunestoneComponent);

describe("RunestonePreview", () => {
  beforeEach(() => {
    renderRunestoneComponentMock.mockClear();
  });

  it("shows an explanatory message when rendered question HTML is unavailable", () => {
    renderWithMantine(<RunestonePreview divId="question-1" />);

    expect(screen.getByText("No rendered question preview available.")).toBeInTheDocument();
    expect(renderRunestoneComponentMock).not.toHaveBeenCalled();
  });

  it("injects the question markup and initializes the Runestone component", async () => {
    const { container } = renderWithMantine(
      <RunestonePreview
        divId="question-1"
        htmlsrc='<div data-testid="rendered-question">Question body</div>'
      />
    );

    expect(screen.getByTestId("rendered-question")).toHaveTextContent("Question body");
    await waitFor(() => expect(renderRunestoneComponentMock).toHaveBeenCalledTimes(1));

    const previewElement = container.querySelector(".ptx-runestone-container > div > div");
    const [previewRef, options] = renderRunestoneComponentMock.mock.calls[0];

    expect(previewRef.current).toBe(previewElement);
    expect(options).toEqual({ isCalledFromBuilder: true, graderactive: false });
  });

  it("renders the question name in the shared preview header", () => {
    renderWithMantine(<QuestionPreviewHeader questionName="parsons-greeting" />);

    expect(screen.getByRole("heading", { name: "Question: parsons-greeting" })).toBeInTheDocument();
  });
});
