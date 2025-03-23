import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Chip } from "primereact/chip";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { FC, useState } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import { ExerciseComponentProps, ExerciseValidation } from "../types/ExerciseTypes";

import { BaseExerciseForm } from "./BaseExerciseForm";

export const ShortAnswerExercise: FC<ExerciseComponentProps> = (props) => {
  const [acceptableAnswers, setAcceptableAnswers] = useState<string[]>([]);
  const [newAnswer, setNewAnswer] = useState("");
  const [minLength, setMinLength] = useState<number | null>(0);
  const [maxLength, setMaxLength] = useState<number | null>(null);
  const [caseSensitive, setCaseSensitive] = useState(false);

  const validate = (): ExerciseValidation => {
    const errors: string[] = [];

    if (acceptableAnswers.length === 0) {
      errors.push("At least one acceptable answer is required");
    }

    if (minLength === null) {
      errors.push("Minimum length is required");
    }

    if (minLength !== null && minLength < 0) {
      errors.push("Minimum length cannot be negative");
    }

    if (maxLength !== null && maxLength < minLength!) {
      errors.push("Maximum length cannot be less than minimum length");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleAddAnswer = () => {
    if (newAnswer.trim() && !acceptableAnswers.includes(newAnswer.trim())) {
      setAcceptableAnswers([...acceptableAnswers, newAnswer.trim()]);
      setNewAnswer("");
    }
  };

  const handleRemoveAnswer = (answer: string) => {
    setAcceptableAnswers(acceptableAnswers.filter((a) => a !== answer));
  };

  const handleSave = async (baseData: CreateExerciseFormType) => {
    await props.onSave(baseData);
  };

  return (
    <BaseExerciseForm
      initialData={props.initialData}
      onSave={handleSave}
      onCancel={props.onCancel}
      validate={validate}
    >
      <div className="flex flex-column gap-4">
        <div className="flex flex-column gap-2">
          <label>Acceptable Answers</label>
          <div className="flex gap-2">
            <InputText
              id="acceptableAnswers"
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Enter an acceptable answer"
              className="flex-1"
            />
            <Button icon="pi pi-plus" onClick={handleAddAnswer} disabled={!newAnswer.trim()} />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {acceptableAnswers.map((answer) => (
              <Chip
                key={answer}
                label={answer}
                removable
                onRemove={() => handleRemoveAnswer(answer)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-column gap-2">
          <label>Minimum Length</label>
          <InputNumber
            id="minLength"
            value={minLength}
            onValueChange={(e) => setMinLength(e.value ?? null)}
            min={0}
            placeholder="Enter minimum length"
          />
        </div>

        <div className="flex flex-column gap-2">
          <label>Maximum Length (optional)</label>
          <InputNumber
            id="maxLength"
            value={maxLength}
            onValueChange={(e) => setMaxLength(e.value ?? null)}
            min={0}
            placeholder="Enter maximum length"
          />
        </div>

        <div className="flex align-items-center gap-2">
          <Checkbox
            inputId="caseSensitive"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.checked ?? false)}
          />
          <label className="ml-2">Case Sensitive</label>
        </div>
      </div>
    </BaseExerciseForm>
  );
};
