import { Tooltip } from "primereact/tooltip";

import { Assignment } from "@/types/assignment";
import { parseUTCDate } from "@/utils/date";

interface VisibilityStatus {
  text: string;
  secondLine?: string;
  color: string;
  icon: string;
  tooltip: string;
}

interface VisibilityStatusBadgeProps {
  assignment: Assignment;
}

const getVisibilityStatus = (assignment: Assignment): VisibilityStatus => {
  const now = new Date();
  const { visible, visible_on, hidden_on } = assignment;

  // Check for scheduled period (both dates set)
  if (visible_on && hidden_on && !visible) {
    const visibleDate = parseUTCDate(visible_on);
    const hiddenDate = parseUTCDate(hidden_on);

    const formatShort = (d: Date) =>
      d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

    if (now < visibleDate) {
      return {
        text: formatShort(visibleDate),
        secondLine: formatShort(hiddenDate),
        color: "#FFA500",
        icon: "pi pi-clock",
        tooltip: `Visible from ${visibleDate.toLocaleString()} to ${hiddenDate.toLocaleString()}`
      };
    } else if (now >= visibleDate && now < hiddenDate) {
      return {
        text: formatShort(visibleDate),
        secondLine: formatShort(hiddenDate),
        color: "#28A745",
        icon: "pi pi-calendar",
        tooltip: `Visible until ${hiddenDate.toLocaleString()}`
      };
    } else {
      return {
        text: formatShort(visibleDate),
        secondLine: formatShort(hiddenDate),
        color: "#DC3545",
        icon: "pi pi-calendar-times",
        tooltip: `Period ended on ${hiddenDate.toLocaleString()}`
      };
    }
  }

  // Hidden state
  if (!visible) {
    if (visible_on) {
      const visibleDate = parseUTCDate(visible_on);
      if (now >= visibleDate) {
        // visible_on has passed - assignment is now visible
        return {
          text: "Visible",
          color: "#28A745",
          icon: "pi pi-eye",
          tooltip: ""
        };
      }
      return {
        text: visibleDate.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        color: "#FFA500",
        icon: "pi pi-clock",
        tooltip: `Will become visible on ${visibleDate.toLocaleString()}`
      };
    }
    // Simple hidden - no tooltip needed
    return {
      text: "Hidden",
      color: "#DC3545",
      icon: "pi pi-eye-slash",
      tooltip: ""
    };
  }

  // Visible state
  if (hidden_on) {
    const hiddenDate = parseUTCDate(hidden_on);
    if (now >= hiddenDate) {
      // Already hidden by schedule - no tooltip needed
      return {
        text: "Hidden",
        color: "#DC3545",
        icon: "pi pi-eye-slash",
        tooltip: ""
      };
    }
    return {
      text: hiddenDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      color: "#17A2B8",
      icon: "pi pi-calendar-times",
      tooltip: `Will be hidden on ${hiddenDate.toLocaleString()}`
    };
  }

  if (visible_on) {
    const visibleDate = parseUTCDate(visible_on);
    if (now >= visibleDate) {
      // Simple visible now - no tooltip needed
      return {
        text: "Visible",
        color: "#28A745",
        icon: "pi pi-eye",
        tooltip: ""
      };
    }
    return {
      text: visibleDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      color: "#FFA500",
      icon: "pi pi-clock",
      tooltip: `Will become visible on ${visibleDate.toLocaleString()}`
    };
  }

  // Simple visible - no tooltip needed
  return {
    text: "Visible",
    color: "#28A745",
    icon: "pi pi-eye",
    tooltip: ""
  };
};

export const VisibilityStatusBadge = ({ assignment }: VisibilityStatusBadgeProps) => {
  const status = getVisibilityStatus(assignment);
  const hasTooltip = status.tooltip !== "";

  return (
    <>
      {hasTooltip && <Tooltip target=".visibility-status-badge" showDelay={200} />}
      <div
        className={
          hasTooltip
            ? "visibility-status-badge flex flex-column align-items-center justify-content-center"
            : "flex flex-column align-items-center justify-content-center"
        }
        style={{
          fontSize: "0.85rem",
          color: status.color,
          fontWeight: 500,
          cursor: hasTooltip ? "help" : "default"
        }}
        {...(hasTooltip && {
          "data-pr-tooltip": status.tooltip,
          "data-pr-position": "top"
        })}
      >
        <div className="flex align-items-center gap-1">
          <i className={status.icon} style={{ fontSize: "0.9rem" }}></i>
          <span>{status.text}</span>
        </div>
        {status.secondLine && <span>{status.secondLine}</span>}
      </div>
    </>
  );
};
