import { Tooltip } from "@mantine/core";

import { Assignment } from "@/types/assignment";
import { parseUTCDate } from "@/utils/date";

import styles from "./VisibilityStatusBadge.module.css";

export type VisibilityVariant = "success" | "info" | "neutral";

export interface VisibilityStatus {
  label: string;
  variant: VisibilityVariant;
  tooltip: string;
}

interface VisibilityStatusBadgeProps {
  assignment: Assignment;
}

const formatShort = (date: Date, now: Date) =>
  date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {})
  });

export const getVisibilityStatus = (
  assignment: Assignment,
  now: Date = new Date()
): VisibilityStatus => {
  const { visible, visible_on, hidden_on } = assignment;

  if (visible_on && hidden_on && !visible) {
    const visibleDate = parseUTCDate(visible_on);
    const hiddenDate = parseUTCDate(hidden_on);

    if (now < visibleDate) {
      return {
        label: `${formatShort(visibleDate, now)} – ${formatShort(hiddenDate, now)}`,
        variant: "info",
        tooltip: `Visible from ${visibleDate.toLocaleString()} to ${hiddenDate.toLocaleString()}`
      };
    }
    if (now < hiddenDate) {
      return {
        label: `Until ${formatShort(hiddenDate, now)}`,
        variant: "success",
        tooltip: `Visible until ${hiddenDate.toLocaleString()}`
      };
    }
    return {
      label: "Hidden",
      variant: "neutral",
      tooltip: `Period ended on ${hiddenDate.toLocaleString()}`
    };
  }

  if (!visible) {
    if (visible_on) {
      const visibleDate = parseUTCDate(visible_on);

      if (now >= visibleDate) {
        return { label: "Visible", variant: "success", tooltip: "" };
      }
      return {
        label: `From ${formatShort(visibleDate, now)}`,
        variant: "info",
        tooltip: `Will become visible on ${visibleDate.toLocaleString()}`
      };
    }
    return { label: "Hidden", variant: "neutral", tooltip: "" };
  }

  if (hidden_on) {
    const hiddenDate = parseUTCDate(hidden_on);

    if (now >= hiddenDate) {
      return { label: "Hidden", variant: "neutral", tooltip: "" };
    }
    return {
      label: `Until ${formatShort(hiddenDate, now)}`,
      variant: "info",
      tooltip: `Will be hidden on ${hiddenDate.toLocaleString()}`
    };
  }

  if (visible_on) {
    const visibleDate = parseUTCDate(visible_on);

    if (now >= visibleDate) {
      return { label: "Visible", variant: "success", tooltip: "" };
    }
    return {
      label: `From ${formatShort(visibleDate, now)}`,
      variant: "info",
      tooltip: `Will become visible on ${visibleDate.toLocaleString()}`
    };
  }

  return { label: "Visible", variant: "success", tooltip: "" };
};

export const VisibilityChip = ({ status }: { status: VisibilityStatus }) => (
  <span className={styles.chip} data-variant={status.variant}>
    <span className={styles.dot} />
    {status.label}
  </span>
);

export const VisibilityStatusBadge = ({ assignment }: VisibilityStatusBadgeProps) => {
  const status = getVisibilityStatus(assignment);

  if (!status.tooltip) {
    return <VisibilityChip status={status} />;
  }

  return (
    <Tooltip
      label={status.tooltip}
      position="top"
      openDelay={200}
      withArrow
      events={{ hover: true, focus: true, touch: true }}
    >
      <span className={styles.chip} data-variant={status.variant} tabIndex={0}>
        <span className={styles.dot} />
        {status.label}
      </span>
    </Tooltip>
  );
};
