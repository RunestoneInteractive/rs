import { DateTimePicker } from "@components/ui/DateTimePicker";
import { Icon, PrimeIconName } from "@components/ui/Icon";
import { Group, Radio, Stack, Text } from "@mantine/core";

import { VisibilityMode } from "../edit/visibilityMode";

interface VisibilityModeFieldsProps {
  mode: VisibilityMode;
  visibleOn: string | null;
  hiddenOn: string | null;
  onModeChange: (mode: VisibilityMode) => void;
  onVisibleOnChange: (value: string) => void;
  onHiddenOnChange: (value: string) => void;
}

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

export const VisibilityModeFields = ({
  mode,
  visibleOn,
  hiddenOn,
  onModeChange,
  onVisibleOnChange,
  onHiddenOnChange
}: VisibilityModeFieldsProps) => (
  <Radio.Group value={mode} onChange={(value) => onModeChange(value as VisibilityMode)}>
    <Stack gap="sm">
      <Radio value="hidden" label={radioLabel(RADIO_OPTIONS[0])} />
      <Radio value="visible" label={radioLabel(RADIO_OPTIONS[1])} />

      <Radio value="scheduled_visible" label={radioLabel(RADIO_OPTIONS[2])} />
      {mode === "scheduled_visible" && (
        <Stack pl="xl">
          <DateTimePicker
            value={visibleOn}
            onChange={onVisibleOnChange}
            withinPortal={false}
            ariaLabel="Visible on date"
          />
        </Stack>
      )}

      <Radio value="scheduled_hidden" label={radioLabel(RADIO_OPTIONS[3])} />
      {mode === "scheduled_hidden" && (
        <Stack pl="xl">
          <DateTimePicker
            value={hiddenOn}
            onChange={onHiddenOnChange}
            withinPortal={false}
            ariaLabel="Hidden on date"
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
              value={visibleOn}
              onChange={onVisibleOnChange}
              withinPortal={false}
              ariaLabel="Visible from date"
            />
          </div>
          <div>
            <Text size="xs" mb={4}>
              Until:
            </Text>
            <DateTimePicker
              value={hiddenOn}
              onChange={onHiddenOnChange}
              withinPortal={false}
              ariaLabel="Hidden after date"
            />
          </div>
        </Stack>
      )}
    </Stack>
  </Radio.Group>
);
