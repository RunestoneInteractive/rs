import { InputText } from "primereact/inputtext";
import { Tooltip } from "primereact/tooltip";
import { FC } from "react";

interface ABExperimentSettingsProps {
  experimentName: string;
  onChange: (experimentName: string) => void;
}

export const ABExperimentSettings: FC<ABExperimentSettingsProps> = ({
  experimentName,
  onChange
}) => {
  return (
    <div className="surface-card border-round p-2">
      <div className="field">
        <label htmlFor="experimentName" className="block text-900 font-medium mb-2">
          A/B Testing
          <i
            className="pi pi-info-circle ml-2 text-500 cursor-pointer"
            id="ab-tooltip-icon"
            data-pr-tooltip="Randomly assigns students to different questions for testing"
            data-pr-position="top"
            style={{ fontSize: "0.875rem" }}
          />
        </label>
        <InputText
          id="experimentName"
          value={experimentName}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Experiment name (optional)"
          className="w-full"
        />
      </div>
      <Tooltip target="#ab-tooltip-icon" style={{ maxWidth: "250px", fontSize: "0.875rem" }} />
    </div>
  );
};
