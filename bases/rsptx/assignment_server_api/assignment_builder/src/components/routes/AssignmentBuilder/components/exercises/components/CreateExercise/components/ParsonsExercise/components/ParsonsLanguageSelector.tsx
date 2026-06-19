import { Select } from "@mantine/core";
import { FC, useMemo } from "react";
import { useSelector } from "react-redux";

import { datasetSelectors } from "@/store/dataset/dataset.logic";

interface ParsonsLanguageSelectorProps {
  language: string;
  onChange: (language: string) => void;
}

export const ParsonsLanguageSelector: FC<ParsonsLanguageSelectorProps> = ({
  language,
  onChange
}) => {
  const baseLanguageOptions = useSelector(datasetSelectors.getLanguageOptions);

  const languageOptions = useMemo(() => {
    const textOption = baseLanguageOptions.find((option) => option.value === "text");

    if (textOption) {
      return baseLanguageOptions;
    }

    return [{ value: "text", label: "Text content" }, ...baseLanguageOptions];
  }, [baseLanguageOptions]);

  return (
    <Select
      value={language || null}
      data={languageOptions}
      onChange={(value) => onChange(value ?? "")}
      placeholder="Select content type"
      allowDeselect={false}
      error={!language}
    />
  );
};
