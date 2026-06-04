import { Center, Checkbox, Loader, TextInput } from "@mantine/core";
import React, { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { RosterStudent, useGetCourseRosterQuery } from "@store/grader/grader.logic.api";

import styles from "../Grader.module.css";

interface StudentMultiSelectProps {
  selected: string[];
  onChange: (sids: string[]) => void;
  label?: string;
  height?: number;
}

const displayName = (s: RosterStudent) => {
  const name = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
  return name ? `${name} (${s.username})` : s.username;
};

export const StudentMultiSelect: React.FC<StudentMultiSelectProps> = ({
  selected,
  onChange,
  label = "Students",
  height = 220
}) => {
  const { data: roster, isLoading, isError } = useGetCourseRosterQuery();
  const [search, setSearch] = useState("");

  const students = useMemo(() => {
    const list = roster ?? [];
    return [...list].sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [roster]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter((s) => displayName(s).toLowerCase().includes(term));
  }, [students, search]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selectedSet.has(s.username));

  const toggle = (username: string) => {
    if (selectedSet.has(username)) {
      onChange(selected.filter((u) => u !== username));
    } else {
      onChange([...selected, username]);
    }
  };

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      const remove = new Set(filtered.map((s) => s.username));
      onChange(selected.filter((u) => !remove.has(u)));
    } else {
      const merged = new Set(selected);
      filtered.forEach((s) => merged.add(s.username));
      onChange(Array.from(merged));
    }
  };

  return (
    <div className={styles.multiSelectRoot}>
      <div className={`${styles.sectionCardHead} ${styles.multiSelectHead}`}>
        <label className={styles.fieldHint}>
          {label}
          {selected.length > 0 && (
            <span className={styles.textSubtle}> &middot; {selected.length} selected</span>
          )}
        </label>
        <button type="button" onClick={toggleAllFiltered} className={styles.linkButton}>
          {allFilteredSelected ? "Clear all" : "Select all"}
        </button>
      </div>
      <TextInput
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        placeholder="Search students…"
        leftSection={<Icon name="search" />}
        size="sm"
      />
      <div className={styles.rosterList} style={{ maxHeight: height }}>
        {isLoading ? (
          <Center p="md">
            <Loader size="sm" />
          </Center>
        ) : isError ? (
          <p className={styles.errorText}>Couldn't load the roster. Try again.</p>
        ) : filtered.length === 0 ? (
          <p className={`${styles.textSubtle} ${styles.rosterEmpty}`}>
            No students match the search.
          </p>
        ) : (
          filtered.map((s) => (
            <div key={s.username} className={styles.rosterRow}>
              <Checkbox
                id={`sms-${s.username}`}
                checked={selectedSet.has(s.username)}
                onChange={() => toggle(s.username)}
                label={displayName(s)}
                size="sm"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudentMultiSelect;
