export const POLL_TYPES = [
  { label: "Scale (1 to N)", value: "scale" },
  { label: "Multiple Options", value: "options" }
];

export const SCALE_CONFIG = {
  MIN: 2,
  MAX: 50,
  DEFAULT: 5
} as const;
