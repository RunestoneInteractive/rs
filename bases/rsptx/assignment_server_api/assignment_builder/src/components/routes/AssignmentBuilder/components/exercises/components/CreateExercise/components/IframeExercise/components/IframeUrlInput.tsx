import { InputText } from "primereact/inputtext";
import { FC } from "react";

import { useValidation } from "../../../shared/ExerciseLayout";
import styles from "../../../shared/styles/CreateExercise.module.css";

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

  return (
    <>
      <div className={styles.formField}>
        <label htmlFor="iframeSrc" className="font-medium block mb-2">
          iFrame Source URL *
        </label>
        <InputText
          id="iframeSrc"
          value={iframeSrc}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/exercise"
          className={`w-full ${shouldShowError ? "p-invalid" : ""}`}
        />
        {shouldShowError && isEmpty && (
          <small className="p-error mt-1 block">iFrame URL is required</small>
        )}
        {shouldShowError && isInvalidUrl && (
          <small className="p-error mt-1 block">Please enter a valid URL</small>
        )}
      </div>

      <div className={styles.questionTips}>
        <i className="pi pi-lightbulb" style={{ marginRight: "4px" }}></i>
        <span>
          Tip: Enter a valid URL that can be embedded in an iframe (e.g., videos, interactive
          content, external tools).
        </span>
      </div>

      {iframeSrc && isValidUrl(iframeSrc) && (
        <div className="mt-4">
          <label className="font-medium block mb-2">Preview</label>
          <div
            style={{
              border: "1px solid var(--surface-border)",
              borderRadius: "6px",
              overflow: "hidden"
            }}
          >
            <iframe
              src={iframeSrc}
              title="iFrame Preview"
              style={{ width: "100%", border: "none" }}
              allowFullScreen
            />
          </div>
        </div>
      )}
    </>
  );
};
