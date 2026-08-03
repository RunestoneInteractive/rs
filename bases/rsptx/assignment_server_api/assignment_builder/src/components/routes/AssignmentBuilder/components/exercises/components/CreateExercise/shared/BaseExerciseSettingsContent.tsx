import { useGetSectionsForChapterQuery } from "@store/dataset/dataset.logic.api";
import { NumberInput, Select, Switch, TagsInput, TextInput } from "@mantine/core";
import { ReactNode, useCallback, useEffect, useState } from "react";

import { difficultyOptions } from "@/config/exerciseTypes";
import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { createExerciseId } from "@/utils/exercise";
import { validateIdName } from "@/utils/sanitize";

import styles from "./styles/CreateExerciseSettings.module.css";

export interface BaseExerciseSettings {
  name: string;
  author: string;
  topic: string;
  chapter: string;
  subchapter?: string;
  tags: string;
  points: number;
  difficulty: number;
  is_private: boolean;
}

export interface BaseExerciseSettingsContentProps<T extends BaseExerciseSettings> {
  initialData?: Partial<T>;
  onSettingsChange: (settings: T) => void;
  additionalFields?: ReactNode;
}

const DEFAULT_POINTS = 3;
const DEFAULT_DIFFICULTY = 1;
const MAX_TAGS = 10;

export const BaseExerciseSettingsContent = <T extends BaseExerciseSettings>({
  initialData,
  onSettingsChange,
  additionalFields
}: BaseExerciseSettingsContentProps<T>) => {
  const { chapters } = useExercisesSelector();

  const [settings, setSettings] = useState<T>({
    ...initialData,
    name: initialData?.name ?? createExerciseId(),
    author: initialData?.author ?? "",
    topic: initialData?.topic ?? "",
    chapter: initialData?.chapter || chapters?.[0]?.value || "",
    subchapter: initialData?.subchapter ?? "",
    tags: initialData?.tags ?? "",
    points: initialData?.points ?? 1,
    difficulty: initialData?.difficulty ?? 3,
    is_private: initialData?.is_private ?? false
  } as T);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateSetting = useCallback((field: keyof T, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // An exercise can arrive here carrying a chapter/subchapter that does not
  // belong to this book -- a copy made before copy_question re-homed them, or
  // one filed under a chapter the book has since dropped. Clear it and make the
  // instructor choose rather than silently refiling the exercise somewhere
  // arbitrary; a label this book does not have hides the exercise everywhere.
  const [rejectedChapter, setRejectedChapter] = useState<string | null>(null);
  const [rejectedSubchapter, setRejectedSubchapter] = useState<string | null>(null);

  useEffect(() => {
    if (!chapters || chapters.length === 0 || rejectedChapter) {
      // Once rejected, leave the field empty until the instructor picks; the
      // default-to-first branch below would otherwise undo the rejection.
      return;
    }

    const currentChapterExists = chapters.some((option) => option.value === settings.chapter);

    if (!settings.chapter) {
      updateSetting("chapter", chapters[0].value);
    } else if (!currentChapterExists) {
      setRejectedChapter(settings.chapter);
      updateSetting("chapter", "");
    }
  }, [chapters, settings.chapter, rejectedChapter, updateSetting]);

  const { data: sectionsOptions = [], isLoading: loadingSections } = useGetSectionsForChapterQuery(
    settings.chapter || "",
    {
      skip: !settings.chapter
    }
  );

  useEffect(() => {
    if (sectionsOptions.length === 0 || rejectedSubchapter) {
      return;
    }

    const currentSubchapterExists = sectionsOptions.some(
      (option) => option.value === settings.subchapter
    );

    if (!settings.subchapter) {
      updateSetting("subchapter", sectionsOptions[0].value);
    } else if (!currentSubchapterExists) {
      setRejectedSubchapter(settings.subchapter);
      updateSetting("subchapter", "");
    }
  }, [sectionsOptions, settings.subchapter, rejectedSubchapter, updateSetting]);

  useEffect(() => {
    onSettingsChange(settings);
  }, [settings, onSettingsChange]);

  const handleTagsChange = (tags: string[]) => {
    updateSetting("tags", tags.join(","));
  };

  const nameValidationError = validateIdName(settings.name);
  const chapterError = !settings.chapter;
  const subchapterError = !loadingSections && !settings.subchapter;
  const chapterErrorMessage = rejectedChapter
    ? `“${rejectedChapter}” is not a chapter in this book. Choose one.`
    : "Chapter is required";
  const subchapterErrorMessage = rejectedSubchapter
    ? `“${rejectedSubchapter}” is not a section of this chapter. Choose one.`
    : "Section is required";
  const pointsError = settings.points <= 0;

  const difficultyData = Object.entries(difficultyOptions).map(([key, label]) => ({
    value: key,
    label: String(label)
  }));

  return (
    <>
      <div className={styles.settingsGrid}>
        <div className={styles.formField}>
          <TextInput
            id="name"
            label="Exercise name"
            withAsterisk
            value={settings.name}
            error={nameValidationError || undefined}
            onChange={(e) => updateSetting("name", e.target.value)}
          />
        </div>

        <div className={styles.formField}>
          <Select
            id="chapter"
            label="Chapter"
            withAsterisk
            value={settings.chapter}
            data={chapters ?? []}
            allowDeselect={false}
            error={chapterError ? chapterErrorMessage : undefined}
            onChange={(value) => {
              setRejectedChapter(null);
              setRejectedSubchapter(null);
              updateSetting("chapter", value ?? "");
              // Sections belong to a chapter, so the current one cannot carry
              // over. Clearing it lets the effect above pick this chapter's
              // first section.
              updateSetting("subchapter", "");
            }}
          />
        </div>

        <div className={styles.formField}>
          <Select
            id="subchapter"
            label="Section"
            withAsterisk
            value={settings.subchapter}
            data={sectionsOptions}
            allowDeselect={false}
            disabled={loadingSections || sectionsOptions.length === 0}
            placeholder={loadingSections ? "Loading sections…" : "Select a section"}
            error={subchapterError ? subchapterErrorMessage : undefined}
            onChange={(value) => {
              setRejectedSubchapter(null);
              updateSetting("subchapter", value ?? "");
            }}
          />
        </div>
      </div>

      <div className={styles.settingsGridTopic}>
        <div className={styles.formField}>
          <TextInput
            id="topic"
            label="Topic"
            value={settings.topic}
            onChange={(e) => updateSetting("topic", e.target.value)}
          />
        </div>

        <div className={styles.formField}>
          <TextInput
            id="author"
            label="Author (or your name)"
            value={settings.author}
            onChange={(e) => updateSetting("author", e.target.value)}
          />
        </div>

        <div className={styles.pointsDifficultyContainer}>
          <div className={styles.formField}>
            <NumberInput
              id="points"
              label="Points"
              withAsterisk
              value={settings.points}
              min={0}
              max={100000}
              error={pointsError ? "Points must be greater than 0" : undefined}
              onChange={(value) =>
                updateSetting("points", value === "" ? DEFAULT_POINTS : Number(value))
              }
            />
          </div>

          <div className={styles.formField}>
            <Select
              id="difficulty"
              label="Difficulty"
              value={String(settings.difficulty)}
              data={difficultyData}
              allowDeselect={false}
              onChange={(value) =>
                updateSetting("difficulty", value ? Number(value) : DEFAULT_DIFFICULTY)
              }
            />
          </div>
        </div>
      </div>

      <div className={styles.settingsGridFull}>
        <div className={styles.formField}>
          <TagsInput
            id="tags"
            label="Tags"
            value={settings.tags ? settings.tags.split(",") : []}
            onChange={handleTagsChange}
            splitChars={[","]}
            maxTags={MAX_TAGS}
            placeholder="Add tags"
            clearable
          />
        </div>
      </div>

      <div className={styles.settingsGridFull}>
        <div className={styles.formField}>
          <Switch
            id="is_private"
            label="Private exercise"
            checked={settings.is_private}
            onChange={(e) => updateSetting("is_private", e.currentTarget.checked)}
          />
        </div>
      </div>

      {additionalFields && <div className={styles.settingsGridFull}>{additionalFields}</div>}
    </>
  );
};
