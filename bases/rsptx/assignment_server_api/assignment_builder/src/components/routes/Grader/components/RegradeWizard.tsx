import { Button, Center, Checkbox, Loader, Modal, Stepper } from "@mantine/core";
import { ColumnDef } from "@tanstack/react-table";
import React, { useEffect, useMemo, useState } from "react";

import { DataGrid } from "@/components/ui/DataGrid";
import {
  GraderQuestionStats,
  RegradeReport,
  RegradeRequest,
  useRegradeMutation,
  useRegradePreviewMutation
} from "@store/grader/grader.logic.api";

import stepperStyles from "@/components/ui/WizardStepper.module.css";

import styles from "../Grader.module.css";
import { isAutogradeable } from "../state/graderSelectors";

import { StudentMultiSelect } from "./StudentMultiSelect";

type RegradeItem = RegradeReport["items"][number];

interface RegradeWizardProps {
  visible: boolean;
  onHide: () => void;
  assignmentId: number;
  questions: GraderQuestionStats[];
  selectedQuestionIds: number[];
  onComplete?: (report: RegradeReport) => void;
}

const PREVIEW_COLUMNS: ColumnDef<RegradeItem, unknown>[] = [
  { accessorKey: "sid", header: "Student" },
  { accessorKey: "div_id", header: "Question" },
  { id: "before", header: "Before", cell: ({ row }) => row.original.old_score ?? "—" },
  { id: "after", header: "After", cell: ({ row }) => row.original.new_score ?? "—" },
  {
    id: "note",
    header: "Note",
    cell: ({ row }) => row.original.skipped || row.original.error || ""
  }
];

export const RegradeWizard: React.FC<RegradeWizardProps> = ({
  visible,
  onHide,
  assignmentId,
  questions,
  selectedQuestionIds,
  onComplete
}) => {
  const [step, setStep] = useState(1);
  const [selectedSids, setSelectedSids] = useState<string[]>([]);
  const [overwriteManual, setOverwriteManual] = useState(false);
  const [enforceDeadline, setEnforceDeadline] = useState(true);
  const [recomputeTotals, setRecomputeTotals] = useState(true);

  const [preview, { isLoading: previewing }] = useRegradePreviewMutation();
  const [run, { isLoading: running }] = useRegradeMutation();
  const [report, setReport] = useState<RegradeReport | null>(null);

  const selectedQuestions = useMemo(
    () => questions.filter((q) => selectedQuestionIds.includes(q.id)),
    [questions, selectedQuestionIds]
  );

  const autogradeable = useMemo(
    () => selectedQuestions.filter(isAutogradeable),
    [selectedQuestions]
  );
  const skipped = useMemo(
    () => selectedQuestions.filter((q) => !isAutogradeable(q)),
    [selectedQuestions]
  );

  const autogradeableIds = useMemo(() => autogradeable.map((q) => q.id), [autogradeable]);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setReport(null);
    }
  }, [visible]);

  const close = () => {
    setStep(1);
    setReport(null);
    onHide();
  };

  const buildRequest = (): RegradeRequest => ({
    assignment_id: assignmentId,
    question_ids: autogradeableIds,
    sids: selectedSids,
    overwrite_manual: overwriteManual,
    enforce_deadline: enforceDeadline,
    recompute_totals: recomputeTotals
  });

  const toPreview = async () => {
    const res = await preview(buildRequest()).unwrap();
    setReport(res);
    setStep(2);
  };

  const doRun = async () => {
    const res = await run(buildRequest()).unwrap();
    setReport(res);
    onComplete?.(res);
    close();
  };

  const hasGradeable = autogradeableIds.length > 0;

  const previewRows = useMemo(
    () => (report ? report.items.filter((i) => i.new_score !== i.old_score) : []),
    [report]
  );

  return (
    <Modal
      title="Regrade selected questions"
      opened={visible}
      onClose={close}
      size="720px"
      centered
    >
      <Stepper active={step - 1} mb="md" size="sm" className={stepperStyles.stepper}>
        <Stepper.Step label="Options" />
        <Stepper.Step label="Preview" />
      </Stepper>

      {step === 1 && (
        <div className={styles.dialogStack}>
          <p className={styles.dialogIntro}>
            {autogradeable.length} of {selectedQuestions.length} selected question
            {selectedQuestions.length === 1 ? "" : "s"} can be auto-graded.
          </p>

          {!hasGradeable && (
            <div className={styles.calloutWarning}>
              None of the selected questions can be auto-graded. Use <strong>Multi-grade</strong> to
              grade them by hand.
            </div>
          )}

          {skipped.length > 0 && hasGradeable && (
            <div className={styles.calloutWarning}>
              {skipped.length} question{skipped.length === 1 ? "" : "s"} will be skipped (not
              auto-gradeable): {skipped.map((q) => q.name).join(", ")}
            </div>
          )}

          <StudentMultiSelect
            selected={selectedSids}
            onChange={setSelectedSids}
            label="Students (leave empty to regrade the whole class)"
            height={180}
          />

          <div className={styles.fieldStack}>
            <Checkbox
              checked={overwriteManual}
              onChange={(e) => setOverwriteManual(e.currentTarget.checked)}
              label="Overwrite grades entered by hand"
            />
            <Checkbox
              checked={enforceDeadline}
              onChange={(e) => setEnforceDeadline(e.currentTarget.checked)}
              label="Only count answers before the deadline (honors exceptions)"
            />
            <Checkbox
              checked={recomputeTotals}
              onChange={(e) => setRecomputeTotals(e.currentTarget.checked)}
              label="Recompute assignment totals and push to the LMS"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={styles.dialogStack}>
          <p className={styles.dialogIntro}>Preview only. Nothing has been saved yet.</p>
          {previewing || !report ? (
            <Center p="xl">
              <Loader />
            </Center>
          ) : (
            <>
              <div className={`${styles.textStrong} ${styles.summaryStrong}`}>
                {report.total} rows &middot; {report.changed} grades will change &middot;{" "}
                {report.skipped_manual} manual skipped &middot; {report.no_submission} no submission
                &middot; {report.errors} errors
              </div>
              <DataGrid<RegradeItem>
                data={previewRows}
                columns={PREVIEW_COLUMNS}
                getRowId={(r, i) => `${r.sid}-${r.div_id}-${i}`}
                initialPageSize={8}
                pageSizeOptions={[8, 25, 50]}
                emptyMessage="No grade changes in this preview."
              />
            </>
          )}
        </div>
      )}

      <div className={`${styles.dialogActionsSpread} ${styles.dialogFooterGap}`}>
        <Button variant="subtle" onClick={close}>
          Cancel
        </Button>
        <div className={styles.dialogActions}>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step === 1 && (
            <Button onClick={toPreview} loading={previewing} disabled={!hasGradeable}>
              Preview
            </Button>
          )}
          {step === 2 && (
            <Button onClick={doRun} loading={running} disabled={!hasGradeable}>
              Run regrade
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default RegradeWizard;
