import { Chips } from "primereact/chips";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { ReactNode, useCallback, useEffect, useState } from "react";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { createExerciseId } from "@/utils/exercise";

import styles from "./styles/CreateExerciseSettings.module.css";

export interface BaseExerciseSettings {
  name: string;
  author: string;
  topic: string;
  chapter: string;
  tags: string;
  points: number;
  difficulty: number;
}

export interface BaseExerciseSettingsContentProps<T extends BaseExerciseSettings> {
  initialData?: Partial<T>;
  onSettingsChange: (settings: T) => void;
  additionalFields?: ReactNode;
}

export const BaseExerciseSettingsContent = <T extends BaseExerciseSettings>({
  initialData,
  onSettingsChange,
  additionalFields
}: BaseExerciseSettingsContentProps<T>) => {
  const { chapters } = useExercisesSelector();

  // Initialize state with default values or initialData
  const [settings, setSettings] = useState<T>(
    () =>
      ({
        name: initialData?.name ?? createExerciseId(),
        author: initialData?.author ?? "",
        topic: initialData?.topic ?? "",
        chapter: initialData?.chapter ?? "",
        tags: initialData?.tags ?? "",
        points: initialData?.points ?? 1,
        difficulty: initialData?.difficulty ?? 3,
        ...initialData // Spread any additional fields from initialData
      }) as T
  );

  // Handler to update a specific setting field
  const updateSetting = useCallback((field: keyof T, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Set the first chapter as default if chapters are available and no chapter is selected
  useEffect(() => {
    if (chapters && chapters.length > 0 && !settings.chapter) {
      updateSetting("chapter", chapters[0].value);
    }
  }, [chapters, settings.chapter, updateSetting]);

  // Report settings changes to parent
  useEffect(() => {
    onSettingsChange(settings);
  }, [settings, onSettingsChange]);

  // Tags handling
  const handleTagsChange = (tags: string[]) => {
    updateSetting("tags", tags.join(","));
  };

  // Check if fields have validation errors
  const nameError = !settings.name?.trim();
  const chapterError = !settings.chapter;
  const pointsError = settings.points <= 0;

  return (
    <>
      <div className={styles.settingsGrid}>
        {/* First row with 3 fields */}
        <div className={styles.formField}>
          <span className="p-float-label">
            <InputText
              id="name"
              value={settings.name}
              className={`w-full ${nameError ? styles.requiredField : ""}`}
              onChange={(e) => updateSetting("name", e.target.value)}
            />
            <label htmlFor="name">Exercise Name*</label>
          </span>
          {nameError && <small className={styles.errorMessage}>Name is required</small>}
        </div>

        <div className={styles.formField}>
          <span className="p-float-label">
            <Dropdown
              id="chapter"
              value={settings.chapter}
              options={chapters}
              optionLabel="label"
              className={`w-full ${chapterError ? styles.requiredField : ""}`}
              onChange={(e) => updateSetting("chapter", e.value)}
            />
            <label htmlFor="chapter">Chapter*</label>
          </span>
          {chapterError && <small className={styles.errorMessage}>Chapter is required</small>}
        </div>

        <div className={styles.formField}>
          <span className="p-float-label">
            <InputText
              id="topic"
              value={settings.topic}
              className="w-full"
              onChange={(e) => updateSetting("topic", e.target.value)}
            />
            <label htmlFor="topic">Topic</label>
          </span>
        </div>
      </div>

      <div className={styles.settingsGrid}>
        {/* Second row with 3 fields */}
        <div className={styles.formField}>
          <span className="p-float-label">
            <InputText
              id="author"
              value={settings.author}
              className="w-full"
              onChange={(e) => updateSetting("author", e.target.value)}
            />
            <label htmlFor="author">Author</label>
          </span>
        </div>

        <div className={styles.formField}>
          <span className="p-float-label">
            <InputNumber
              id="points"
              value={settings.points}
              min={0}
              max={100000}
              className={`w-full ${pointsError ? styles.requiredField : ""}`}
              onValueChange={(e) => updateSetting("points", e.value !== null ? e.value : 1)}
            />
            <label htmlFor="points">Points*</label>
          </span>
          {pointsError && (
            <small className={styles.errorMessage}>Points must be greater than 0</small>
          )}
        </div>

        <div className={styles.formField}>
          <span className="p-float-label">
            <InputNumber
              id="difficulty"
              value={settings.difficulty}
              min={1}
              max={5}
              className="w-full"
              onValueChange={(e) => updateSetting("difficulty", e.value !== null ? e.value : 3)}
            />
            <label htmlFor="difficulty">Difficulty</label>
          </span>
        </div>
      </div>

      <div className={styles.settingsGridFull}>
        <div className={styles.formField}>
          <span className="p-float-label">
            <Chips
              id="tags"
              value={settings.tags ? settings.tags.split(",") : []}
              onChange={(e) => handleTagsChange(e.value || [])}
              className="w-full"
              allowDuplicate={false}
              separator=","
              addOnBlur
              max={10}
            />
            <label htmlFor="tags">Tags</label>
          </span>
        </div>
      </div>

      {/* Render additional fields if provided */}
      {additionalFields && <div className={styles.settingsGridFull}>{additionalFields}</div>}
    </>
  );
};
