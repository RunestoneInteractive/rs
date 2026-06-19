import { Radio, Stack } from "@mantine/core";
import { FC, useState } from "react";

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
      label: "Single question",
      value: "none",
      description: "Student sees only one question from the list"
    },
    {
      label: "Allow question switching",
      value: "toggle",
      description: "Student can switch between questions, any question can be graded"
    },
    {
      label: "Switch with lock",
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
        <h4 className={styles.title}>Question interaction mode</h4>
      </div>

      <p className={styles.description}>Choose how students interact with the question list.</p>

      <Radio.Group value={selectedMode} onChange={handleModeChange}>
        <Stack gap="sm" className={styles.optionsSection}>
          {toggleModes.map((mode) => (
            <Radio
              key={mode.value}
              value={mode.value}
              label={mode.label}
              description={mode.description}
            />
          ))}
        </Stack>
      </Radio.Group>
    </div>
  );
};
