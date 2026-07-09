import { Button, Checkbox, Popover, TextInput, UnstyledButton } from "@mantine/core";
import { useMemo, useState } from "react";

import { Icon } from "../Icon";

import styles from "./FilterMultiSelect.module.css";

export interface FilterMultiSelectOption {
  label: string;
  value: string;
}

interface FilterMultiSelectProps {
  label: string;
  options: FilterMultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  width?: number;
  searchThreshold?: number;
}

const DEFAULT_SEARCH_THRESHOLD = 8;

export const FilterMultiSelect = ({
  label,
  options,
  value,
  onChange,
  width = 280,
  searchThreshold = DEFAULT_SEARCH_THRESHOLD
}: FilterMultiSelectProps) => {
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => new Set(value), [value]);
  const searchable = options.length > searchThreshold;

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (optionValue: string) => {
    if (selected.has(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <Popover
      width={width}
      position="bottom-end"
      opened={opened}
      onChange={setOpened}
      trapFocus
      returnFocus
    >
      <Popover.Target>
        <UnstyledButton
          className={styles.target}
          data-active={value.length > 0 || undefined}
          data-expanded={opened || undefined}
          aria-expanded={opened}
          aria-label={label}
          onClick={() => setOpened((current) => !current)}
        >
          <span>{label}</span>
          {value.length > 0 && <span className={styles.countBadge}>{value.length}</span>}
          <span className={styles.chevron}>
            <Icon name="chevron-down" size={14} />
          </span>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div className={styles.dropdown}>
          {searchable && (
            <div className={styles.search}>
              <TextInput
                size="xs"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder="Search…"
                leftSection={<Icon name="search" size={14} />}
                aria-label={`Search ${label.toLowerCase()}`}
              />
            </div>
          )}
          <div className={styles.list} role="group" aria-label={label}>
            {visibleOptions.length === 0 ? (
              <span className={styles.empty}>No matches</span>
            ) : (
              visibleOptions.map((option) => (
                <label key={option.value} className={styles.option}>
                  <Checkbox
                    size="sm"
                    checked={selected.has(option.value)}
                    onChange={() => toggle(option.value)}
                    aria-label={option.label}
                  />
                  <span className={styles.optionLabel}>{option.label}</span>
                </label>
              ))
            )}
          </div>
          <div className={styles.footer}>
            <span className={styles.footerCount}>
              {value.length === 1 ? "1 selected" : `${value.length} selected`}
            </span>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              disabled={value.length === 0}
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          </div>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
};
