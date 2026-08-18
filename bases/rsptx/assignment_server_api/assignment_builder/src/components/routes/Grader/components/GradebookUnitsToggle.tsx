import { SegmentedControl, Tooltip } from "@mantine/core";
import React from "react";

import { notify } from "@/components/ui/notify";
import { useSetGradebookUnitsMutation } from "@store/grader/grader.logic.api";

interface GradebookUnitsToggleProps {
  /** Whether the course currently shows raw points instead of percentages. */
  showPoints: boolean;
  disabled?: boolean;
}

/**
 * Flipping the gradebook between percentages and points is the same course
 * attribute the course settings page edits, so the tooltip says out loud that
 * this is not a private view preference.
 */
const UNITS_TOOLTIP =
  "Course-wide setting: it changes the gradebook and the CSV export for every " +
  "instructor of this course, and LTI 1.3 grade passback sends points or a score " +
  "out of 100 to match.";

export const GradebookUnitsToggle: React.FC<GradebookUnitsToggleProps> = ({
  showPoints,
  disabled = false
}) => {
  const [setUnits, { isLoading }] = useSetGradebookUnitsMutation();

  const apply = async (value: string) => {
    const nextShowPoints = value === "points";

    // Mantine fires onChange for the already-selected segment too; writing the
    // attribute again would only add noise to the log.
    if (nextShowPoints === showPoints) return;
    try {
      await setUnits({ show_points: nextShowPoints }).unwrap();
      notify.success(
        nextShowPoints ? "Gradebook now shows points" : "Gradebook now shows percentages"
      );
    } catch {
      notify.error("Couldn't change the gradebook units. Try again.");
    }
  };

  return (
    <Tooltip label={UNITS_TOOLTIP} position="bottom" multiline w={280}>
      <div>
        <SegmentedControl
          size="xs"
          value={showPoints ? "points" : "percent"}
          onChange={apply}
          disabled={disabled || isLoading}
          aria-label="Show grades as percentages or points"
          data={[
            { label: "%", value: "percent" },
            { label: "Points", value: "points" }
          ]}
        />
      </div>
    </Tooltip>
  );
};

export default GradebookUnitsToggle;
