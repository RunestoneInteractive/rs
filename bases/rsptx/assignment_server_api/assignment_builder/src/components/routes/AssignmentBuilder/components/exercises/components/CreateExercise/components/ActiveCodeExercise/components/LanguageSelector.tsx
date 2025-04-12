import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { FC, useEffect } from "react";
import { useSelector } from "react-redux";

import { datasetSelectors } from "@/store/dataset/dataset.logic";

interface LanguageSelectorProps {
  language: string;
  onChange: (language: string) => void;
  showValidation: boolean;
}

export const LanguageSelector: FC<LanguageSelectorProps> = ({
  language,
  onChange,
  showValidation
}) => {
  const languageOptions = useSelector(datasetSelectors.getLanguageOptions);

  return (
    <div className="p-4">
      <div className="p-6 bg-blue-50 border-round shadow-sm max-w-xl mx-auto">
        <div className="flex align-items-center gap-1 mb-3">
          <h3 className="text-xl font-medium mb-0">Programming Language</h3>
          <Button
            icon="pi pi-info-circle"
            rounded
            text
            severity="info"
            tooltip="The selected language will determine the syntax highlighting. Once you choose a language and proceed, all code editors in the exercise will use this language for syntax highlighting. The language can be changed later, but it will affect all code sections."
            tooltipOptions={{ position: "right", showDelay: 150, style: { maxWidth: "300px" } }}
            style={{ width: "24px", height: "24px", padding: 0 }}
          />
        </div>

        <div className="mb-4">
          <Dropdown
            value={language}
            options={languageOptions}
            onChange={(e) => onChange(e.value)}
            placeholder="Select programming language"
            className={`w-full ${showValidation && !language ? "p-invalid" : ""}`}
          />
          {showValidation && !language && (
            <small className="p-error block mt-1">Programming language is required</small>
          )}
        </div>
      </div>
    </div>
  );
};
