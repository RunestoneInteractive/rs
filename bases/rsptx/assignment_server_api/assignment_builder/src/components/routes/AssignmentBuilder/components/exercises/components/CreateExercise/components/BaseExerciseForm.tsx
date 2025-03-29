import { Button } from "primereact/button";
import { Divider } from "primereact/divider";
import { Editor } from "primereact/editor";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { useEffect, useState } from "react";

import { Exercise } from "@/types/exercises";

import { BaseExerciseProps, ExerciseValidation } from "../types/ExerciseTypes";

export const BaseExerciseForm = ({
  initialData,
  onSave,
  onCancel,
  children,
  validate,
  onDataChange
}: BaseExerciseProps & {
  children?: React.ReactNode;
  validate?: () => ExerciseValidation;
  onDataChange?: (data: Partial<Exercise>) => void;
}) => {
  const [data, setData] = useState<Partial<Exercise>>(initialData ?? {});

  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    onDataChange?.(data);
  }, [data, onDataChange]);

  const handleSave = () => {
    if (validate) {
      const validation = validate();

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }
    }

    if (!data.assignment_id) {
      setErrors(["Assignment ID is required"]);
      return;
    }

    onSave(data as Exercise);
  };

  const updateData = (updates: Partial<Exercise>) => {
    setData((prev) => ({ ...prev, ...updates }));
    setErrors([]);
  };

  return (
    <div className="surface-card p-4 border-round">
      <div className="grid">
        <div className="col-12 md:col-8">
          <div className="field">
            <label htmlFor="title" className="font-medium block mb-2">
              Title
            </label>
            <InputText
              id="title"
              value={data.title}
              onChange={(e) => updateData({ title: e.target.value })}
              className="w-full"
              placeholder="Enter exercise title"
            />
          </div>
        </div>

        <div className="col-12 md:col-4">
          <div className="field">
            <label htmlFor="points" className="font-medium block mb-2">
              Points
            </label>
            <InputNumber
              id="points"
              value={data.points}
              onValueChange={(e) => updateData({ points: e.value ?? 1 })}
              className="w-full"
              min={0}
              showButtons
            />
          </div>
        </div>

        <div className="col-12">
          <div className="field">
            <label htmlFor="description" className="font-medium block mb-2">
              Description
            </label>
            <Editor
              value={data.description}
              onTextChange={(e) => updateData({ description: e.htmlValue ?? "" })}
              style={{ height: "200px" }}
            />
          </div>
        </div>

        <div className="col-12">{children}</div>

        {errors.length > 0 && (
          <div className="col-12">
            {errors.map((error, index) => (
              <Message key={index} severity="error" text={error} className="mb-2" />
            ))}
          </div>
        )}
      </div>

      <Divider />

      <div className="flex justify-content-end gap-2">
        <Button label="Cancel" icon="pi pi-times" onClick={onCancel} className="p-button-text" />
        <Button label="Save" icon="pi pi-check" onClick={handleSave} />
      </div>
    </div>
  );
};
