import type { GraderQuestionStats, RegradeReport } from "@store/grader/grader.logic.api";
import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen, waitFor } from "@/test/renderWithMantine";

import { RegradeWizard } from "./RegradeWizard";

const { mockPreview, mockRun } = vi.hoisted(() => ({
  mockPreview: vi.fn(),
  mockRun: vi.fn()
}));

vi.mock("@store/grader/grader.logic.api", () => ({
  useRegradePreviewMutation: () => [mockPreview, { isLoading: false }],
  useRegradeMutation: () => [mockRun, { isLoading: false }]
}));

vi.mock("./StudentMultiSelect", () => ({
  StudentMultiSelect: () => null
}));

vi.mock("@/components/ui/DataGrid", () => ({
  DataGrid: () => null
}));

const question: GraderQuestionStats = {
  id: 7,
  name: "q1",
  question_type: "mchoice",
  points: 5,
  autograde: "all_or_nothing",
  answered_count: 1,
  total_attempts: 1,
  correct_count: 1,
  average_score: 5
};

const report: RegradeReport = {
  total: 1,
  changed: 0,
  skipped_manual: 0,
  no_submission: 0,
  errors: 0,
  items: []
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPreview.mockReturnValue({ unwrap: () => Promise.resolve(report) });
  mockRun.mockReturnValue({ unwrap: () => Promise.resolve(report) });
});

it("defaults resend off and includes it in the preview and run requests", async () => {
  renderWithMantine(
    <RegradeWizard
      visible
      onHide={vi.fn()}
      assignmentId={42}
      questions={[question]}
      selectedQuestionIds={[7]}
    />
  );

  const resend = screen.getByRole("checkbox", {
    name: "Resend all scores via LTI (force update even unchanged)"
  });
  const recompute = screen.getByRole("checkbox", {
    name: "Recompute assignment totals and push to the LMS"
  });

  expect(resend).not.toBeChecked();
  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(mockPreview).toHaveBeenCalledWith(
    expect.objectContaining({ resend_all_scores_via_lti: false })
  );

  await userEvent.click(await screen.findByRole("button", { name: "Back" }));
  const resendAfterBack = screen.getByRole("checkbox", {
    name: "Resend all scores via LTI (force update even unchanged)"
  });
  const recomputeAfterBack = screen.getByRole("checkbox", {
    name: "Recompute assignment totals and push to the LMS"
  });

  await userEvent.click(resendAfterBack);
  expect(resendAfterBack).toBeChecked();
  expect(recomputeAfterBack).toBeChecked();
  expect(recomputeAfterBack).toBeDisabled();

  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
  await waitFor(() =>
    expect(mockPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        recompute_totals: true,
        resend_all_scores_via_lti: true
      })
    )
  );

  await userEvent.click(await screen.findByRole("button", { name: "Run regrade" }));
  await waitFor(() =>
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({ resend_all_scores_via_lti: true })
    )
  );
});
