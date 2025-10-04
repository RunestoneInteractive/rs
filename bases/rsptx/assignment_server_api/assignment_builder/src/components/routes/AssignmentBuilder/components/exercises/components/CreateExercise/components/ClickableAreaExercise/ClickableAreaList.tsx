import { Button } from "primereact/button";

import { ClickableArea } from "./types";

interface ClickableAreaListProps {
  areas: ClickableArea[];
  onRemove: (id: string) => void;
}

export const ClickableAreaList = ({ areas, onRemove }: ClickableAreaListProps) => {
  if (areas.length === 0) {
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded border text-gray-500 text-center text-sm">
        No clickable areas selected. Select text in the editor above and mark it as correct or
        incorrect.
      </div>
    );
  }

  return (
    <div className="mt-3">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Clickable Areas</h4>
      <div className="space-y-2">
        {areas.map((area) => (
          <div
            key={area.id}
            className="flex items-center justify-between p-2 border rounded text-sm"
            style={{
              backgroundColor: area.isCorrect ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
              borderColor: area.isCorrect ? "#22c55e" : "#ef4444"
            }}
          >
            <div className="flex items-center gap-2 flex-1">
              <i
                className={`fa-solid ${area.isCorrect ? "fa-check" : "fa-xmark"}`}
                style={{ color: area.isCorrect ? "#22c55e" : "#ef4444" }}
              />
              <span className="font-mono">{area.text}</span>
              <span className="text-xs text-gray-500">
                ({area.isCorrect ? "Correct" : "Incorrect"})
              </span>
            </div>
            <Button
              icon="pi pi-trash"
              text
              severity="danger"
              size="small"
              onClick={() => onRemove(area.id)}
              tooltip="Remove"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
