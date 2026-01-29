import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Tooltip } from "primereact/tooltip";
import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import {
  BaseExerciseSettings,
  BaseExerciseSettingsContent
} from "../../shared/BaseExerciseSettingsContent";
import styles from "../../shared/styles/CreateExerciseSettings.module.css";

interface ActiveCodeExerciseSettingsProps {
  formData: Partial<CreateExerciseFormType>;
  onChange: (settings: Partial<CreateExerciseFormType>) => void;
}

const PERSONALIZATION_LEVELS = [
  { label: "Solution", value: "solution-level" },
  { label: "Solution & Block", value: "block-and-solution" }
];

export const ActiveCodeExerciseSettings: FC<ActiveCodeExerciseSettingsProps> = ({
  formData,
  onChange
}) => {
  const handleCodeTailorToggle = (enabled: boolean) => {
    onChange({
      enableCodeTailor: enabled,
      // Reset personalization level when disabling
      parsonspersonalize: enabled ? "solution-level" : "",
      // Reset parsons example when disabling
      parsonsexample: enabled ? formData.parsonsexample : ""
    });
  };

  const handlePersonalizationChange = (value: "solution-level" | "block-and-solution") => {
    onChange({ parsonspersonalize: value });
  };

  const handleParsonsExampleChange = (value: string) => {
    onChange({ parsonsexample: value });
  };

  const codeTailorFields = (
    <div className={styles.codeTailorSection}>
      <div className={styles.formField}>
        <div className="flex align-items-center gap-4">
          <div className="flex align-items-center gap-2">
            <InputSwitch
              id="enableCodeTailor"
              checked={formData.enableCodeTailor ?? false}
              onChange={(e) => handleCodeTailorToggle(e.value)}
            />
            <label htmlFor="enableCodeTailor" className="font-medium">
              Personalized Parsons Support (CodeTailor)
            </label>
            <i
              className="pi pi-info-circle codetailor-info-icon"
              data-pr-tooltip="CodeTailor provides personalized Parsons puzzles as adaptive support for students struggling with coding exercises."
              data-pr-position="right"
            />
            <Tooltip target=".codetailor-info-icon" />
          </div>

          <div className="flex align-items-center gap-2">
            <InputSwitch
              id="enableCodelens"
              checked={formData.enableCodelens ?? true}
              onChange={(e) => onChange({ enableCodelens: e.value })}
            />
            <label htmlFor="enableCodelens" className="font-medium">
              Show CodeLens Button
            </label>
            <i
              className="pi pi-info-circle codelens-info-icon"
              data-pr-tooltip="CodeLens button provides step-by-step visualization of code execution."
              data-pr-position="right"
            />
            <Tooltip target=".codelens-info-icon" />
          </div>
        </div>
      </div>

      {formData.enableCodeTailor && (
        <div className={styles.codeTailorOptions}>
          <div className={styles.formField}>
            <span className="p-float-label">
              <Dropdown
                id="parsonspersonalize"
                value={formData.parsonspersonalize || "solution-level"}
                options={PERSONALIZATION_LEVELS}
                optionLabel="label"
                className="w-full"
                onChange={(e) => handlePersonalizationChange(e.value)}
              />
              <label htmlFor="parsonspersonalize">Personalization Level</label>
            </span>
          </div>

          <div className={styles.formField}>
            <span className="p-float-label">
              <InputText
                id="parsonsexample"
                value={formData.parsonsexample || ""}
                className="w-full"
                onChange={(e) => handleParsonsExampleChange(e.target.value)}
                placeholder="Enter a ParsonProb Question id(optional)"
              />
              <label htmlFor="parsonsexample">Backup Example Solution</label>
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <BaseExerciseSettingsContent<BaseExerciseSettings>
      initialData={formData}
      onSettingsChange={onChange}
      additionalFields={codeTailorFields}
    />
  );
};
