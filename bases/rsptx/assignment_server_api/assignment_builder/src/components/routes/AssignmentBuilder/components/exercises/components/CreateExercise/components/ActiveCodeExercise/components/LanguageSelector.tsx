import { Select } from "@mantine/core";
import { FC } from "react";
import { useSelector } from "react-redux";

import { datasetSelectors } from "@/store/dataset/dataset.logic";

interface LanguageSelectorProps {
  language: string;
  onChange: (language: string) => void;
}

export const LanguageSelector: FC<LanguageSelectorProps> = ({ language, onChange }) => {
  const languageOptions = useSelector(datasetSelectors.getLanguageOptions);

  return (
    <Select
      value={language || null}
      data={languageOptions}
      onChange={(value) => onChange(value ?? "")}
      placeholder="Select programming language"
      allowDeselect={false}
      error={!language}
    />
  );
};
