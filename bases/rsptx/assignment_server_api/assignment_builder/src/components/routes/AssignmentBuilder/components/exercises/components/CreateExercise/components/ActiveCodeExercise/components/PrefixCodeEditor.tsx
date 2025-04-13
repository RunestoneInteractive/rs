import { Button } from "primereact/button";
import { FC } from "react";

import { CodeHighlighter } from "../../../shared/CodeHighlighter";

interface PrefixCodeEditorProps {
  prefixCode: string;
  onChange: (code: string) => void;
  language: string;
}

export const PrefixCodeEditor: FC<PrefixCodeEditorProps> = ({ prefixCode, onChange, language }) => {
  return (
    <div className="p-4">
      <div className="p-4 bg-white border-round shadow-1">
        <div className="mb-3">
          <div className="p-4 bg-blue-50 border-round mb-4">
            <div className="flex align-items-center gap-1">
              <h3 className="text-xl font-medium mb-0">Hidden Prefix Code</h3>
              <Button
                icon="pi pi-info-circle"
                rounded
                text
                severity="info"
                tooltip="This code will be executed before the student's code but will not be visible in the exercise. It's useful for setting up variables, importing libraries, or providing helper functions. This code is optional. Leave it empty if you don't need any prefix code."
                tooltipOptions={{ position: "right", showDelay: 150, style: { maxWidth: "300px" } }}
                style={{ width: "24px", height: "24px", padding: 0 }}
              />
            </div>
          </div>

          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <CodeHighlighter
              code={prefixCode}
              language={language}
              onChange={onChange}
              height="400px"
              placeholder="Enter code that will run before the student's code..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};
