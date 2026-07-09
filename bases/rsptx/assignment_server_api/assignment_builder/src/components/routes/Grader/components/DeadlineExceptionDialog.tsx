import { Button, Checkbox, Group, Modal, NumberInput, Radio } from "@mantine/core";
import React, { useEffect, useState } from "react";

import {
  AccommodationPayload,
  useUpsertAccommodationMutation
} from "@store/grader/grader.logic.api";

import styles from "../Grader.module.css";

import { StudentMultiSelect } from "./StudentMultiSelect";

interface DeadlineExceptionDialogProps {
  visible: boolean;
  onHide: () => void;
  assignmentId: number;
  presetSids?: string[];
  onSaved?: () => void;
}

export const DeadlineExceptionDialog: React.FC<DeadlineExceptionDialogProps> = ({
  visible,
  onHide,
  assignmentId,
  presetSids,
  onSaved
}) => {
  const [selectedSids, setSelectedSids] = useState<string[]>(presetSids ?? []);
  const [scope, setScope] = useState<"assignment" | "all">("assignment");
  const [extraDays, setExtraDays] = useState<number | null>(0);
  const [timeMultiplier, setTimeMultiplier] = useState<number | null>(1);
  const [visibleFlag, setVisibleFlag] = useState(false);
  const [allowLink, setAllowLink] = useState(false);

  const [upsert, { isLoading }] = useUpsertAccommodationMutation();

  useEffect(() => {
    if (visible) {
      setSelectedSids(presetSids ?? []);
    }
  }, [visible, (presetSids ?? []).join(",")]);

  const close = () => onHide();

  const save = async () => {
    if (selectedSids.length === 0) return;
    const payload: AccommodationPayload = {
      sids: selectedSids,
      assignment_id: scope === "assignment" ? assignmentId : null,
      duedate: extraDays ?? undefined,
      time_limit: timeMultiplier ?? undefined,
      visible: visibleFlag,
      allowLink
    };
    await upsert(payload).unwrap();
    onSaved?.();
    close();
  };

  return (
    <Modal
      title="Deadline exception / Extra time"
      opened={visible}
      onClose={close}
      size="560px"
      centered
    >
      <div className={styles.dialogStack}>
        <StudentMultiSelect
          selected={selectedSids}
          onChange={setSelectedSids}
          label="Students"
          height={180}
        />
        <Radio.Group value={scope} onChange={(v) => setScope(v as "assignment" | "all")}>
          <Group gap="lg">
            <Radio value="assignment" label="This assignment" />
            <Radio value="all" label="All of the student's assignments" />
          </Group>
        </Radio.Group>
        <div className={styles.numberFieldRow}>
          <div>
            <label className={styles.fieldHint}>Extend deadline by (days)</label>
            <NumberInput
              value={extraDays ?? ""}
              onChange={(v) => setExtraDays(typeof v === "number" ? v : 0)}
              min={0}
            />
          </div>
          <div>
            <label className={styles.fieldHint}>Time-limit multiplier</label>
            <NumberInput
              value={timeMultiplier ?? ""}
              onChange={(v) => setTimeMultiplier(typeof v === "number" ? v : 1)}
              min={0}
              step={0.5}
              decimalScale={2}
            />
          </div>
        </div>
        <Group gap="lg">
          <Checkbox
            checked={visibleFlag}
            onChange={(e) => setVisibleFlag(e.currentTarget.checked)}
            label="Make visible"
          />
          <Checkbox
            checked={allowLink}
            onChange={(e) => setAllowLink(e.currentTarget.checked)}
            label="Allow link"
          />
        </Group>
        <div className={styles.dialogActionsSpread}>
          <Button variant="subtle" onClick={close}>
            Cancel
          </Button>
          <Button onClick={save} loading={isLoading}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeadlineExceptionDialog;
