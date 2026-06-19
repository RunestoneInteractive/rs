import { Group, Stack, TextInput } from "@mantine/core";
import { FC } from "react";

import { Icon } from "@/components/ui/Icon";

import { useValidation } from "../../../shared/ExerciseLayout";
import shared from "../../../shared/styles/CreateExercise.module.css";

import styles from "./IframeUrlInput.module.css";

interface IframeUrlInputProps {
  iframeSrc: string;
  onChange: (url: string) => void;
}

const isValidUrl = (url: string): boolean => {
  if (!url.trim()) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const IframeUrlInput: FC<IframeUrlInputProps> = ({ iframeSrc, onChange }) => {
  const { shouldShowValidation } = useValidation();
  const isEmpty = !iframeSrc?.trim();
  const isInvalidUrl = iframeSrc?.trim() && !isValidUrl(iframeSrc);
  const shouldShowError = (isEmpty || isInvalidUrl) && shouldShowValidation;
  const errorMessage = shouldShowError
    ? isEmpty
      ? "Iframe URL is required"
      : "Enter a valid URL (https://…)"
    : undefined;

  return (
    <Stack gap="md">
      <TextInput
        id="iframeSrc"
        label="Iframe URL"
        withAsterisk
        value={iframeSrc}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com/exercise"
        error={errorMessage}
      />

      <Group className={shared.questionTips} gap={6} align="center" wrap="nowrap">
        <Icon name="lightbulb" size={14} color="currentColor" />
        <span>
          Tip: Enter a valid URL that can be embedded in an iframe (e.g., videos, interactive
          content, external tools).
        </span>
      </Group>

      {iframeSrc && isValidUrl(iframeSrc) && (
        <div className={styles.previewWrapper}>
          <label className={styles.previewLabel}>Preview</label>
          <div className={styles.previewFrame}>
            <iframe
              src={iframeSrc}
              title="Iframe preview"
              className={styles.previewIframe}
              allowFullScreen
            />
          </div>
        </div>
      )}
    </Stack>
  );
};
