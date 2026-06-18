import { Group, Paper, TextInput, Tooltip } from "@mantine/core";
import { FC } from "react";

import { Icon } from "@/components/ui/Icon";

interface ABExperimentSettingsProps {
  experimentName: string;
  onChange: (experimentName: string) => void;
}

export const ABExperimentSettings: FC<ABExperimentSettingsProps> = ({
  experimentName,
  onChange
}) => {
  return (
    <Paper p="sm" withBorder radius="md">
      <TextInput
        id="experimentName"
        label={
          <Group gap={6} component="span" align="center">
            A/B Testing
            <Tooltip
              label="Randomly assigns students to different questions for testing"
              position="top"
              multiline
              w={250}
            >
              <span>
                <Icon name="info-circle" size={14} />
              </span>
            </Tooltip>
          </Group>
        }
        value={experimentName}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Experiment name (optional)"
      />
    </Paper>
  );
};
