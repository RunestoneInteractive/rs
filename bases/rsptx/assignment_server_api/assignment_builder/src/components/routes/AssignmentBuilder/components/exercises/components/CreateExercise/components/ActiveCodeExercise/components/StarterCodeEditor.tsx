import { Button } from "primereact/button";
import { FC } from "react";

import { CodeHighlighter } from "../../../shared/CodeHighlighter";

interface StarterCodeEditorProps {
  starterCode: string;
  onChange: (code: string) => void;
  language: string;
  showValidation: boolean;
}

export const StarterCodeEditor: FC<StarterCodeEditorProps> = ({
  starterCode,
  onChange,
  language,
  showValidation
}) => {
  return (
    <div className="p-4">
      <div className="p-4 bg-white border-round shadow-1">
        <div className="mb-3">
          <div className="p-4 bg-blue-50 border-round mb-4">
            <div className="flex align-items-center gap-1">
              <h3 className="text-xl font-medium mb-0">Starter Code</h3>
              <Button
                icon="pi pi-info-circle"
                rounded
                text
                severity="info"
                tooltip="This is the code that students will see and modify when they begin the exercise. Provide enough structure to guide them, but leave key parts for them to implement."
                tooltipOptions={{ position: "right", showDelay: 150, style: { maxWidth: "300px" } }}
                style={{ width: "24px", height: "24px", padding: 0 }}
              />
            </div>
          </div>

          <div
            className={`border rounded-lg overflow-hidden ${showValidation && !starterCode ? "border-red-500" : "border-gray-300"}`}
          >
            <CodeHighlighter
              code={starterCode}
              language={language}
              onChange={onChange}
              height="400px"
              placeholder="Enter starter code for students..."
            />
          </div>

          {showValidation && !starterCode && (
            <small className="p-error block mt-1">Starter code is required</small>
          )}
        </div>
      </div>
    </div>
  );
};
