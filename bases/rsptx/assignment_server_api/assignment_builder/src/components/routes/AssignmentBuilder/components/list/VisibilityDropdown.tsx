import { Icon, PrimeIconName } from "@components/ui/Icon";
import { Group, Popover, Radio, Stack, Text, UnstyledButton } from "@mantine/core";
import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { Assignment } from "@/types/assignment";
import { convertDateToISO, parseUTCDate } from "@/utils/date";

import { DateTimePicker } from "../../../../ui/DateTimePicker";
import { getVisibilityMode, getVisibilityValues, VisibilityMode } from "../edit/visibilityMode";

import { getVisibilityStatus, VisibilityChip } from "./VisibilityStatusBadge";
import styles from "./VisibilityStatusBadge.module.css";

interface VisibilityDropdownProps {
  assignment: Assignment;
  onChange: (
    assignment: Assignment,
    data: { visible: boolean; visible_on: string | null; hidden_on: string | null }
  ) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const modeOf = (assignment: Assignment): VisibilityMode =>
  getVisibilityMode(assignment.visible, assignment.visible_on, assignment.hidden_on);

interface RadioOption {
  value: VisibilityMode;
  label: string;
  icon: PrimeIconName;
  color: string;
}

const RADIO_OPTIONS: RadioOption[] = [
  { value: "hidden", label: "Hidden", icon: "eye-slash", color: "var(--rs-text-muted)" },
  { value: "visible", label: "Visible", icon: "eye", color: "var(--rs-success-text)" },
  {
    value: "scheduled_visible",
    label: "Visible on…",
    icon: "clock",
    color: "var(--rs-info-text)"
  },
  {
    value: "scheduled_hidden",
    label: "Hidden on…",
    icon: "calendar-times",
    color: "var(--rs-info-text)"
  },
  {
    value: "scheduled_period",
    label: "Visible during period",
    icon: "calendar",
    color: "var(--rs-info-text)"
  }
];

const radioLabel = (option: RadioOption) => (
  <Group gap={4} align="center" wrap="nowrap">
    <Icon name={option.icon} size={14} color={option.color} />
    <Text size="sm">{option.label}</Text>
  </Group>
);

export const VisibilityDropdown = ({ assignment, onChange }: VisibilityDropdownProps) => {
  const periodInputId = useId();
  const [opened, setOpened] = useState(false);
  const [mode, setMode] = useState<VisibilityMode>(() => modeOf(assignment));
  const [visibleOn, setVisibleOn] = useState<string | null>(assignment.visible_on);
  const [hiddenOn, setHiddenOn] = useState<string | null>(assignment.hidden_on);
  const [calendarOpened, setCalendarOpened] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstRadioRef = useRef<HTMLInputElement>(null);
  const focusFirstRadioOnOpen = useRef(false);

  const status = getVisibilityStatus(assignment);

  useEffect(() => {
    if (opened && focusFirstRadioOnOpen.current) {
      firstRadioRef.current?.focus();
      focusFirstRadioOnOpen.current = false;
    }
  }, [opened]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setMode(modeOf(assignment));
      setVisibleOn(assignment.visible_on);
      setHiddenOn(assignment.hidden_on);
    } else {
      setCalendarOpened(false);
    }
    setOpened(next);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (opened || !["Enter", " ", "ArrowDown"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    focusFirstRadioOnOpen.current = true;
    handleOpenChange(true);
  };

  const handleDropdownKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  };

  const focusPeriodDateInput = (
    event: KeyboardEvent<HTMLElement>,
    targetId: string,
    backwards = false
  ) => {
    if (
      event.currentTarget.tagName === "INPUT" &&
      event.key === "Tab" &&
      event.shiftKey === backwards
    ) {
      event.preventDefault();
      document.getElementById(targetId)?.focus();
    }
  };

  const handleModeChange = (newMode: VisibilityMode) => {
    let newVisibleOn = visibleOn;
    let newHiddenOn = hiddenOn;

    if ((newMode === "scheduled_visible" || newMode === "scheduled_period") && !newVisibleOn) {
      const startOfDay = new Date();

      startOfDay.setHours(0, 0, 0, 0);
      newVisibleOn = convertDateToISO(startOfDay);
    }
    if ((newMode === "scheduled_hidden" || newMode === "scheduled_period") && !newHiddenOn) {
      const endOfDay = new Date();

      endOfDay.setHours(23, 59, 0, 0);
      newHiddenOn = convertDateToISO(endOfDay);
    }

    setMode(newMode);
    setVisibleOn(newVisibleOn);
    setHiddenOn(newHiddenOn);
    onChange(assignment, getVisibilityValues(newMode, newVisibleOn, newHiddenOn));
  };

  const handleVisibleOnChange = (val: string) => {
    let newHiddenOn = hiddenOn;

    if (mode === "scheduled_period" && newHiddenOn) {
      const newVisibleDate = parseUTCDate(val);
      const currentHiddenDate = parseUTCDate(newHiddenOn);

      if (newVisibleDate >= currentHiddenDate) {
        newHiddenOn = convertDateToISO(new Date(newVisibleDate.getTime() + DAY_MS));
        setHiddenOn(newHiddenOn);
      }
    }
    setVisibleOn(val);
    onChange(assignment, getVisibilityValues(mode, val, newHiddenOn));
  };

  const handleHiddenOnChange = (val: string) => {
    let newVisibleOn = visibleOn;

    if (mode === "scheduled_period" && newVisibleOn) {
      const newHiddenDate = parseUTCDate(val);
      const currentVisibleDate = parseUTCDate(newVisibleOn);

      if (newHiddenDate <= currentVisibleDate) {
        newVisibleOn = convertDateToISO(new Date(newHiddenDate.getTime() - DAY_MS));
        setVisibleOn(newVisibleOn);
      }
    }
    setHiddenOn(val);
    onChange(assignment, getVisibilityValues(mode, newVisibleOn, val));
  };

  return (
    <Popover
      width={300}
      position="bottom"
      withArrow
      returnFocus
      closeOnClickOutside={!calendarOpened}
      opened={opened}
      onChange={handleOpenChange}
    >
      <Popover.Target>
        <UnstyledButton
          ref={triggerRef}
          className={styles.trigger}
          data-expanded={opened || undefined}
          onClick={() => handleOpenChange(!opened)}
          onKeyDown={handleTriggerKeyDown}
          aria-label={`${status.label}. Change visibility`}
          title={status.tooltip || "Click to change visibility"}
        >
          <VisibilityChip status={status} />
          <span className={styles.chevron}>
            <Icon name="chevron-down" size={13} color="currentColor" />
          </span>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown onKeyDownCapture={handleDropdownKeyDownCapture}>
        <Radio.Group value={mode} onChange={(value) => handleModeChange(value as VisibilityMode)}>
          <Stack gap="sm">
            <Text fw={600} size="sm">
              Visibility status
            </Text>

            <Radio ref={firstRadioRef} value="hidden" label={radioLabel(RADIO_OPTIONS[0])} />
            <Radio value="visible" label={radioLabel(RADIO_OPTIONS[1])} />

            <Radio value="scheduled_visible" label={radioLabel(RADIO_OPTIONS[2])} />
            {mode === "scheduled_visible" && (
              <Stack pl="xl">
                <DateTimePicker
                  value={visibleOn}
                  onChange={handleVisibleOnChange}
                  ariaLabel="Visible on date"
                  onCalendarOpen={() => setCalendarOpened(true)}
                  onCalendarClose={() => setCalendarOpened(false)}
                />
              </Stack>
            )}

            <Radio value="scheduled_hidden" label={radioLabel(RADIO_OPTIONS[3])} />
            {mode === "scheduled_hidden" && (
              <Stack pl="xl">
                <DateTimePicker
                  value={hiddenOn}
                  onChange={handleHiddenOnChange}
                  ariaLabel="Hidden on date"
                  onCalendarOpen={() => setCalendarOpened(true)}
                  onCalendarClose={() => setCalendarOpened(false)}
                />
              </Stack>
            )}

            <Radio value="scheduled_period" label={radioLabel(RADIO_OPTIONS[4])} />
            {mode === "scheduled_period" && (
              <Stack pl="xl" gap="xs">
                <div>
                  <Text size="xs" mb={4}>
                    From:
                  </Text>
                  <DateTimePicker
                    id={`${periodInputId}-start`}
                    value={visibleOn}
                    onChange={handleVisibleOnChange}
                    ariaLabel="Visible from date"
                    onCalendarOpen={() => setCalendarOpened(true)}
                    onCalendarClose={() => setCalendarOpened(false)}
                    onKeyDown={(event) => focusPeriodDateInput(event, `${periodInputId}-end`)}
                  />
                </div>
                <div>
                  <Text size="xs" mb={4}>
                    Until:
                  </Text>
                  <DateTimePicker
                    id={`${periodInputId}-end`}
                    value={hiddenOn}
                    onChange={handleHiddenOnChange}
                    ariaLabel="Hidden after date"
                    onCalendarOpen={() => setCalendarOpened(true)}
                    onCalendarClose={() => setCalendarOpened(false)}
                    onKeyDown={(event) =>
                      focusPeriodDateInput(event, `${periodInputId}-start`, true)
                    }
                  />
                </div>
              </Stack>
            )}
          </Stack>
        </Radio.Group>
      </Popover.Dropdown>
    </Popover>
  );
};
