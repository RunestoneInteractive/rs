import { OverlayPanel } from "primereact/overlaypanel";
import { RadioButton } from "primereact/radiobutton";
import { useRef, useState } from "react";

import { Assignment } from "@/types/assignment";
import { convertDateToISO, parseUTCDate } from "@/utils/date";

import { DateTimePicker } from "../../../../ui/DateTimePicker";

type VisibilityMode =
  | "hidden"
  | "visible"
  | "scheduled_visible"
  | "scheduled_hidden"
  | "scheduled_period";

interface VisibilityStatus {
  text: string;
  secondLine?: string;
  color: string;
  icon: string;
}

interface VisibilityDropdownProps {
  assignment: Assignment;
  onChange: (
    assignment: Assignment,
    data: { visible: boolean; visible_on: string | null; hidden_on: string | null }
  ) => void;
}

const getVisibilityMode = (assignment: Assignment): VisibilityMode => {
  const { visible, visible_on, hidden_on } = assignment;

  if (!visible) {
    if (visible_on && hidden_on) return "scheduled_period";
    if (visible_on) return "scheduled_visible";
    return "hidden";
  } else {
    if (hidden_on) return "scheduled_hidden";
    return "visible";
  }
};

const getVisibilityStatus = (assignment: Assignment): VisibilityStatus => {
  const now = new Date();
  const { visible, visible_on, hidden_on } = assignment;

  if (visible_on && hidden_on && !visible) {
    const visibleDate = parseUTCDate(visible_on);
    const hiddenDate = parseUTCDate(hidden_on);

    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

    if (now < visibleDate) {
      return {
        text: fmt(visibleDate),
        secondLine: fmt(hiddenDate),
        color: "#FFA500",
        icon: "pi pi-clock"
      };
    } else if (now >= visibleDate && now < hiddenDate) {
      return {
        text: fmt(visibleDate),
        secondLine: fmt(hiddenDate),
        color: "#28A745",
        icon: "pi pi-calendar"
      };
    } else {
      return {
        text: fmt(visibleDate),
        secondLine: fmt(hiddenDate),
        color: "#DC3545",
        icon: "pi pi-calendar-times"
      };
    }
  }

  if (!visible) {
    if (visible_on) {
      const visibleDate = parseUTCDate(visible_on);
      if (now >= visibleDate) {
        // visible_on has passed, assignment is now visible
        return { text: "Visible", color: "#28A745", icon: "pi pi-eye" };
      }
      return {
        text: visibleDate.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        color: "#FFA500",
        icon: "pi pi-clock"
      };
    }
    return { text: "Hidden", color: "#DC3545", icon: "pi pi-eye-slash" };
  }

  if (hidden_on) {
    const hiddenDate = parseUTCDate(hidden_on);
    if (now >= hiddenDate) {
      return { text: "Hidden", color: "#DC3545", icon: "pi pi-eye-slash" };
    }
    return {
      text: hiddenDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      color: "#17A2B8",
      icon: "pi pi-calendar-times"
    };
  }

  if (visible_on) {
    const visibleDate = parseUTCDate(visible_on);
    if (now >= visibleDate) {
      return { text: "Visible", color: "#28A745", icon: "pi pi-eye" };
    }
    return {
      text: visibleDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      color: "#FFA500",
      icon: "pi pi-clock"
    };
  }

  return { text: "Visible", color: "#28A745", icon: "pi pi-eye" };
};

export const VisibilityDropdown = ({ assignment, onChange }: VisibilityDropdownProps) => {
  const overlayRef = useRef<OverlayPanel>(null);
  const [mode, setMode] = useState<VisibilityMode>(() => getVisibilityMode(assignment));
  const [visibleOn, setVisibleOn] = useState<string | null>(assignment.visible_on);
  const [hiddenOn, setHiddenOn] = useState<string | null>(assignment.hidden_on);

  const status = getVisibilityStatus(assignment);

  const handleOpen = (e: React.MouseEvent) => {
    // Reset local state to current assignment values when opening
    setMode(getVisibilityMode(assignment));
    setVisibleOn(assignment.visible_on);
    setHiddenOn(assignment.hidden_on);
    overlayRef.current?.toggle(e);
  };

  const computeValues = (
    newMode: VisibilityMode,
    newVisibleOn: string | null,
    newHiddenOn: string | null
  ) => {
    switch (newMode) {
      case "hidden":
        return { visible: false, visible_on: null, hidden_on: null };
      case "visible":
        return { visible: true, visible_on: null, hidden_on: null };
      case "scheduled_visible":
        return { visible: false, visible_on: newVisibleOn, hidden_on: null };
      case "scheduled_hidden":
        return { visible: true, visible_on: null, hidden_on: newHiddenOn };
      case "scheduled_period":
        return { visible: false, visible_on: newVisibleOn, hidden_on: newHiddenOn };
    }
  };

  const handleModeChange = (newMode: VisibilityMode) => {
    let newVisibleOn = visibleOn;
    let newHiddenOn = hiddenOn;

    if (newMode === "scheduled_visible" && !newVisibleOn) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      newVisibleOn = convertDateToISO(startOfDay);
    }
    if (newMode === "scheduled_hidden" && !newHiddenOn) {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 0, 0);
      newHiddenOn = convertDateToISO(endOfDay);
    }
    if (newMode === "scheduled_period") {
      if (!newVisibleOn) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        newVisibleOn = convertDateToISO(startOfDay);
      }
      if (!newHiddenOn) {
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 0, 0);
        newHiddenOn = convertDateToISO(endOfDay);
      }
    }

    setMode(newMode);
    setVisibleOn(newVisibleOn);
    setHiddenOn(newHiddenOn);

    const values = computeValues(newMode, newVisibleOn, newHiddenOn);
    onChange(assignment, values);
  };

  const DAY_MS = 24 * 60 * 60 * 1000;

  const handleVisibleOnChange = (val: string) => {
    let newHiddenOn = hiddenOn;
    if (mode === "scheduled_period" && newHiddenOn) {
      const newVisibleDate = parseUTCDate(val);
      const currentHiddenDate = parseUTCDate(newHiddenOn);
      if (newVisibleDate >= currentHiddenDate) {
        const adjusted = new Date(newVisibleDate.getTime() + DAY_MS);
        newHiddenOn = convertDateToISO(adjusted);
        setHiddenOn(newHiddenOn);
      }
    }
    setVisibleOn(val);
    const values = computeValues(mode, val, newHiddenOn);
    onChange(assignment, values);
  };

  const handleHiddenOnChange = (val: string) => {
    let newVisibleOn = visibleOn;
    if (mode === "scheduled_period" && newVisibleOn) {
      const newHiddenDate = parseUTCDate(val);
      const currentVisibleDate = parseUTCDate(newVisibleOn);
      if (newHiddenDate <= currentVisibleDate) {
        const adjusted = new Date(newHiddenDate.getTime() - DAY_MS);
        newVisibleOn = convertDateToISO(adjusted);
        setVisibleOn(newVisibleOn);
      }
    }
    setHiddenOn(val);
    const values = computeValues(mode, newVisibleOn, val);
    onChange(assignment, values);
  };

  return (
    <>
      <div
        onClick={handleOpen}
        style={{
          fontSize: "0.85rem",
          color: status.color,
          fontWeight: 500,
          cursor: "pointer",
          display: "flex",
          flexDirection: status.secondLine ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: status.secondLine ? "0px" : "4px"
        }}
        title="Click to change visibility"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <i className={status.icon} style={{ fontSize: "0.9rem" }} />
          <span>{status.text}</span>
          {!status.secondLine && (
            <i
              className="pi pi-chevron-down"
              style={{ fontSize: "0.7rem", marginLeft: "2px", opacity: 0.6 }}
            />
          )}
        </div>
        {status.secondLine && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span>{status.secondLine}</span>
            <i
              className="pi pi-chevron-down"
              style={{ fontSize: "0.7rem", marginLeft: "2px", opacity: 0.6 }}
            />
          </div>
        )}
      </div>
      <OverlayPanel
        ref={overlayRef}
        dismissable
        style={{ width: "300px" }}
        pt={{
          content: { style: { padding: "0.75rem" } }
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
            Visibility Status
          </div>

          <div className="flex align-items-center">
            <RadioButton
              inputId={`vis-hidden-${assignment.id}`}
              value="hidden"
              checked={mode === "hidden"}
              onChange={() => handleModeChange("hidden")}
            />
            <label
              htmlFor={`vis-hidden-${assignment.id}`}
              className="ml-2 cursor-pointer"
              style={{ fontSize: "0.85rem" }}
            >
              <i className="pi pi-eye-slash" style={{ color: "#DC3545", marginRight: "4px" }} />
              Hidden
            </label>
          </div>

          <div className="flex align-items-center">
            <RadioButton
              inputId={`vis-visible-${assignment.id}`}
              value="visible"
              checked={mode === "visible"}
              onChange={() => handleModeChange("visible")}
            />
            <label
              htmlFor={`vis-visible-${assignment.id}`}
              className="ml-2 cursor-pointer"
              style={{ fontSize: "0.85rem" }}
            >
              <i className="pi pi-eye" style={{ color: "#28A745", marginRight: "4px" }} />
              Visible
            </label>
          </div>

          <div className="flex flex-column gap-2">
            <div className="flex align-items-center">
              <RadioButton
                inputId={`vis-scheduled-visible-${assignment.id}`}
                value="scheduled_visible"
                checked={mode === "scheduled_visible"}
                onChange={() => handleModeChange("scheduled_visible")}
              />
              <label
                htmlFor={`vis-scheduled-visible-${assignment.id}`}
                className="ml-2 cursor-pointer"
                style={{ fontSize: "0.85rem" }}
              >
                <i className="pi pi-clock" style={{ color: "#FFA500", marginRight: "4px" }} />
                Visible on...
              </label>
            </div>
            {mode === "scheduled_visible" && (
              <div style={{ marginLeft: "1.75rem" }}>
                <DateTimePicker value={visibleOn} onChange={handleVisibleOnChange} utc />
              </div>
            )}
          </div>

          <div className="flex flex-column gap-2">
            <div className="flex align-items-center">
              <RadioButton
                inputId={`vis-scheduled-hidden-${assignment.id}`}
                value="scheduled_hidden"
                checked={mode === "scheduled_hidden"}
                onChange={() => handleModeChange("scheduled_hidden")}
              />
              <label
                htmlFor={`vis-scheduled-hidden-${assignment.id}`}
                className="ml-2 cursor-pointer"
                style={{ fontSize: "0.85rem" }}
              >
                <i
                  className="pi pi-calendar-times"
                  style={{ color: "#17A2B8", marginRight: "4px" }}
                />
                Hidden on...
              </label>
            </div>
            {mode === "scheduled_hidden" && (
              <div style={{ marginLeft: "1.75rem" }}>
                <DateTimePicker value={hiddenOn} onChange={handleHiddenOnChange} utc />
              </div>
            )}
          </div>

          <div className="flex flex-column gap-2">
            <div className="flex align-items-center">
              <RadioButton
                inputId={`vis-scheduled-period-${assignment.id}`}
                value="scheduled_period"
                checked={mode === "scheduled_period"}
                onChange={() => handleModeChange("scheduled_period")}
              />
              <label
                htmlFor={`vis-scheduled-period-${assignment.id}`}
                className="ml-2 cursor-pointer"
                style={{ fontSize: "0.85rem" }}
              >
                <i className="pi pi-calendar" style={{ color: "#6366F1", marginRight: "4px" }} />
                Visible during period
              </label>
            </div>
            {mode === "scheduled_period" && (
              <div
                style={{
                  marginLeft: "1.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem"
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                    From:
                  </label>
                  <DateTimePicker value={visibleOn} onChange={handleVisibleOnChange} utc />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                    Until:
                  </label>
                  <DateTimePicker value={hiddenOn} onChange={handleHiddenOnChange} utc />
                </div>
              </div>
            )}
          </div>
        </div>
      </OverlayPanel>
    </>
  );
};
