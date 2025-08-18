import { RadioButton } from "primereact/radiobutton";
import React, { FC, useState } from "react";

import styles from "./ToggleOptionsSettings.module.css";

interface ToggleOptionsSettingsProps {
  toggleOptions: string[];
  onChange: (toggleOptions: string[]) => void;
}

export const ToggleOptionsSettings: FC<ToggleOptionsSettingsProps> = ({
  toggleOptions,
  onChange
}) => {
  const [selectedMode, setSelectedMode] = useState<string>(() => {
    if (toggleOptions.length === 0) return "none";
    if (toggleOptions.includes("toggle") && toggleOptions.includes("lock")) return "toggle_lock";
    if (toggleOptions.includes("toggle")) return "toggle";
    return "none";
  });

  const toggleModes = [
    {
      label: "Single Question",
      value: "none",
      description: "Student sees only one question from the list"
    },
    {
      label: "Allow Question Switching",
      value: "toggle",
      description: "Student can switch between questions, any question can be graded"
    },
    {
      label: "Switch with Lock",
      value: "toggle_lock",
      description: "Student can switch between questions, but only first question is graded"
    }
  ];

  const handleModeChange = (mode: string) => {
    setSelectedMode(mode);

    let newOptions: string[];

    switch (mode) {
      case "toggle":
        newOptions = ["toggle"];
        break;
      case "toggle_lock":
        newOptions = ["toggle", "lock"];
        break;
      case "none":
      default:
        newOptions = [];
        break;
    }

    onChange(newOptions);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Question Interaction Mode</h4>
      </div>

      <p className={styles.description}>Choose how students interact with the question list.</p>

      <div className={styles.optionsSection}>
        {toggleModes.map((mode) => (
          <div key={mode.value} className={styles.optionItem}>
            <RadioButton
              inputId={mode.value}
              value={mode.value}
              checked={selectedMode === mode.value}
              onChange={(e) => handleModeChange(e.value)}
            />
            <label htmlFor={mode.value} className={styles.optionLabel}>
              <span className="font-medium">{mode.label}</span>
              <span className={styles.optionDescription}> - {mode.description}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
