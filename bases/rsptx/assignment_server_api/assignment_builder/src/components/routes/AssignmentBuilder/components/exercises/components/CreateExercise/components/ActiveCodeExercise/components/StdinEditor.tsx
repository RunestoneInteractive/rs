import { FC } from "react";

import { InputTextarea } from "primereact/inputtextarea";

interface StdinEditorProps {
  stdin: string;
  onChange: (stdin: string) => void;
}

export const StdinEditor: FC<StdinEditorProps> = ({ stdin, onChange }) => {
  return (
    <div className="stdin-editor">
      <div className="field">
        <InputTextarea
          id="stdin-input"
          value={stdin}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          cols={50}
          className="w-full"
          placeholder="Enter input data here...&#10;Line 1&#10;Line 2&#10;Line 3"
          style={{ resize: "vertical" }}
        />
        <small className="text-gray-500 mt-1 block">
          Tip: Each line you enter here will be available as a line of input to the student's
          program.
        </small>
      </div>
    </div>
  );
};
