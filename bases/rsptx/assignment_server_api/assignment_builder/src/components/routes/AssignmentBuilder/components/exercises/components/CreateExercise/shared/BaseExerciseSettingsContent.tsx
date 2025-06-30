import { useGetSectionsForChapterQuery } from "@store/dataset/dataset.logic.api";
import { Chips } from "primereact/chips";
import { Dropdown } from "primereact/dropdown";
import { InputNumber, InputNumberChangeEvent } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
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

export const BaseExerciseSettingsContent = <T extends BaseExerciseSettings>({
  initialData,
  onSettingsChange,
  additionalFields
}: BaseExerciseSettingsContentProps<T>) => {
  const { chapters } = useExercisesSelector();

  // Initialize state with default values or initialData
  const [settings, setSettings] = useState<T>({
    ...initialData, // Spread any additional fields from initialData
    name: initialData?.name ?? createExerciseId(),
    author: initialData?.author ?? "",
    topic: initialData?.topic ?? "",
    chapter: initialData?.chapter || chapters?.[0].value || "",
    subchapter: initialData?.subchapter ?? "",
    tags: initialData?.tags ?? "",
    points: initialData?.points ?? 1,
    difficulty: initialData?.difficulty ?? 3,
    is_private: initialData?.is_private ?? false
  } as T);

  // Handler to update a specific setting field
  const updateSetting = useCallback((field: keyof T, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Set the first chapter as default if chapters are available and no valid chapter is selected
  useEffect(() => {
    if (chapters && chapters.length > 0) {
      const currentChapterExists = chapters.some((option) => option.value === settings.chapter);

      if (!settings.chapter || !currentChapterExists) {
        updateSetting("chapter", chapters[0].value);
      }
    }
  }, [chapters, settings.chapter, updateSetting]);

  const { data: sectionsOptions = [], isLoading: loadingSections } = useGetSectionsForChapterQuery(
    settings.chapter || "",
    {
      skip: !settings.chapter
    }
  );

  // Set first section as default when sections are loaded and no valid section is selected
  useEffect(() => {
    if (sectionsOptions.length > 0) {
      const currentSubchapterExists = sectionsOptions.some(
        (option) => option.value === settings.subchapter
      );

      if (!settings.subchapter || !currentSubchapterExists) {
        updateSetting("subchapter", sectionsOptions[0].value);
      }
    }
  }, [sectionsOptions, settings.subchapter, updateSetting]);

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
  const subchapterError = !loadingSections && !settings.subchapter;
  const pointsError = settings.points <= 0;

  const defaultValues = {
    difficulty: 1,
    points: 3
  };
  const onChangeInputNumber = (e: InputNumberChangeEvent, field: "difficulty" | "points") => {
    updateSetting(field, e.value !== null ? e.value : defaultValues[field]);
  };

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
            <Dropdown
              id="subchapter"
              value={settings.subchapter}
              options={sectionsOptions}
              optionLabel="label"
              className={`w-full ${subchapterError ? styles.requiredField : ""}`}
              onChange={(e) => updateSetting("subchapter", e.value)}
              disabled={loadingSections || sectionsOptions.length === 0}
              placeholder={loadingSections ? "Loading sections..." : "Select a section"}
            />
            <label htmlFor="subchapter">Section*</label>
          </span>
          {subchapterError && <small className={styles.errorMessage}>Section is required</small>}
        </div>
      </div>

      <div className={styles.settingsGridTopic}>
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

        <div className={styles.formField}>
          <span className="p-float-label">
            <InputText
              id="author"
              value={settings.author}
              className="w-full"
              onChange={(e) => updateSetting("author", e.target.value)}
            />
            <label htmlFor="author">Author (or your name)</label>
          </span>
        </div>

        <div className={styles.pointsDifficultyContainer}>
          <div className={styles.formField}>
            <span className="p-float-label">
              <InputNumber
                id="points"
                value={settings.points}
                min={0}
                max={100000}
                className={`w-full ${pointsError ? styles.requiredField : ""}`}
                onChange={(e) => onChangeInputNumber(e, "points")}
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
                onChange={(e) => onChangeInputNumber(e, "difficulty")}
              />
              <label htmlFor="difficulty">Difficulty</label>
            </span>
          </div>
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

      <div className={styles.settingsGridFull}>
        <div className={styles.formField}>
          <div className="flex align-items-center gap-2">
            <InputSwitch
              id="is_private"
              checked={settings.is_private}
              onChange={(e) => updateSetting("is_private", e.value)}
            />
            <label htmlFor="is_private" className="font-medium">
              Private Exercise
            </label>
          </div>
        </div>
      </div>

      {/* Render additional fields if provided */}
      {additionalFields && <div className={styles.settingsGridFull}>{additionalFields}</div>}
    </>
  );
};
