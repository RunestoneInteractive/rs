import { Button } from "primereact/button";
import { FC } from "react";

import { CodeHighlighter } from "../../../shared/CodeHighlighter";

interface InstructionsEditorProps {
  instructions: string;
  onChange: (instructions: string) => void;
  showValidation: boolean;
}

export const InstructionsEditor: FC<InstructionsEditorProps> = ({
  instructions,
  onChange,
  showValidation
}) => {
  return (
    <div className="p-4">
      <div className="p-4 bg-white border-round shadow-1">
        <div className="mb-3">
          <div className="p-4 bg-blue-50 border-round mb-4">
            <div className="flex align-items-center gap-1">
              <h3 className="text-xl font-medium mb-0">Instructions (HTML)</h3>
              <Button
                icon="pi pi-info-circle"
                rounded
                text
                severity="info"
                tooltip="Provide clear explanations of what students need to do in this exercise. Include any requirements, hints, or background information using HTML formatting."
                tooltipOptions={{ position: "right", showDelay: 150, style: { maxWidth: "300px" } }}
                style={{ width: "24px", height: "24px", padding: 0 }}
              />
            </div>
          </div>

          <div
            className={`border rounded-lg overflow-hidden ${
              showValidation && !instructions?.trim() ? "border-red-500" : "border-gray-300"
            }`}
          >
            <CodeHighlighter
              code={instructions}
              language="html"
              onChange={onChange}
              height="400px"
              placeholder="Enter HTML instructions here..."
            />
          </div>

          {showValidation && !instructions?.trim() && (
            <small className="p-error block mt-1">Instructions are required</small>
          )}
        </div>
      </div>
    </div>
  );
};
