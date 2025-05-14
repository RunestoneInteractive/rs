import { Dropdown } from "primereact/dropdown";
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

    return [{ value: "text", label: "Text Content" }, ...baseLanguageOptions];
  }, [baseLanguageOptions]);

  return (
    <div className="mb-4">
      <Dropdown
        value={language}
        options={languageOptions}
        onChange={(e) => onChange(e.value)}
        placeholder="Select content type"
        className={`w-full ${!language ? "p-invalid" : ""}`}
      />
    </div>
  );
};
