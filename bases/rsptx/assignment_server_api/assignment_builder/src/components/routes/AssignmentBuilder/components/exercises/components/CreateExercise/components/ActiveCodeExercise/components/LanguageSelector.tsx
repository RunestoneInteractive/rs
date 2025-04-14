import { Dropdown } from "primereact/dropdown";
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
    <div className="mb-4">
      <Dropdown
        value={language}
        options={languageOptions}
        onChange={(e) => onChange(e.value)}
        placeholder="Select programming language"
        className={`w-full ${!language ? "p-invalid" : ""}`}
      />
    </div>
  );
};
