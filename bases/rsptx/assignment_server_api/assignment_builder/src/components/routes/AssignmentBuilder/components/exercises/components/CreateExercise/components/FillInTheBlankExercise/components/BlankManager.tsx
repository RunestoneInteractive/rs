import { RegexEditor } from "@components/ui/Regex/RegexEditor";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { FC, useEffect, useState, Suspense } from "react";
import React from "react";

import styles from "../../../shared/styles/CreateExercise.module.css";
import { BlankWithFeedback, GraderType } from "../types";

interface BlankManagerProps {
  blanks: BlankWithFeedback[];
  onChange: (blanks: BlankWithFeedback[]) => void;
  questionText: string;
}

const graderOptions = [
  { label: "String Match", value: GraderType.STRING },
  { label: "Regular Expression", value: GraderType.REGEX },
  { label: "Number Range", value: GraderType.NUMBER }
];

const createBlank = (): BlankWithFeedback => ({
  id: `blank-${Date.now()}`,
  graderType: GraderType.STRING,
  exactMatch: "",
  correctFeedback: "Correct!",
  incorrectFeedback: "Incorrect, please try again."
});

export const BlankManager: FC<BlankManagerProps> = ({ blanks, onChange, questionText }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const blankCount = (questionText.match(/{blank}/g) || []).length;
  const hasNoBlankPlaceholders = blankCount === 0;
  const hasMissingBlanks = blanks.length < blankCount;
  const hasExtraBlanks = blanks.length > blankCount;

  useEffect(() => {
    if (hasMissingBlanks) {
      const newBlanks = [...blanks];
      const blanksToAdd = blankCount - blanks.length;

      for (let i = 0; i < blanksToAdd; i++) {
        newBlanks.push(createBlank());
      }

      onChange(newBlanks);
    } else if (hasExtraBlanks) {
      const trimmedBlanks = blanks.slice(0, blankCount);

      onChange(trimmedBlanks);
    }
  }, [blankCount, blanks.length]);

  const updateBlank = (index: number, field: keyof BlankWithFeedback, value: any) => {
    const updatedBlanks = [...blanks];

    updatedBlanks[index] = {
      ...updatedBlanks[index],
      [field]: value
    };
    onChange(updatedBlanks);
  };

  const handleGraderTypeChange = (index: number, type: GraderType) => {
    const updatedBlanks = [...blanks];

    let newBlank: BlankWithFeedback = {
      id: updatedBlanks[index].id,
      graderType: type,
      correctFeedback: updatedBlanks[index].correctFeedback,
      incorrectFeedback: updatedBlanks[index].incorrectFeedback
    };

    if (type === GraderType.STRING) {
      newBlank = {
        ...newBlank,
        exactMatch: updatedBlanks[index].exactMatch || ""
      };
    } else if (type === GraderType.REGEX) {
      newBlank = {
        ...newBlank,
        regexPattern: updatedBlanks[index].regexPattern || "",
        regexFlags: updatedBlanks[index].regexFlags || ""
      };
    } else if (type === GraderType.NUMBER) {
      newBlank = {
        ...newBlank,
        numberMin: updatedBlanks[index].numberMin || "",
        numberMax: updatedBlanks[index].numberMax || ""
      };
    }

    updatedBlanks[index] = newBlank;
    onChange(updatedBlanks);
  };

  const handleRegexInputChange = (index: number, value: string) => {
    const updatedBlanks = [...blanks];
    let pattern = "";
    let flags = "";

    if (value.startsWith("/") && value.lastIndexOf("/") > 0 && value.lastIndexOf("/") !== 0) {
      const lastSlashIndex = value.lastIndexOf("/");

      pattern = value.substring(1, lastSlashIndex);
      flags = value.substring(lastSlashIndex + 1);
    } else {
      pattern = value;
    }

    updatedBlanks[index] = {
      ...updatedBlanks[index],
      regexPattern: pattern,
      regexFlags: flags
    };

    onChange(updatedBlanks);
  };

  const getRegexDisplayValue = (blank: BlankWithFeedback) => {
    if (!blank.regexPattern) return "";

    if (blank.regexPattern.startsWith("/")) {
      return blank.regexPattern;
    }

    return `/${blank.regexPattern}/${blank.regexFlags || ""}`;
  };

  if (hasNoBlankPlaceholders) {
    return (
      <div className={styles.questionContainer}>
        <div className={styles.questionHeader}>
          <h3>Answer Fields</h3>
        </div>
        <div className={styles.questionContent}>
          <Message
            severity="info"
            text="Add {blank} placeholders in your question text first. Answer fields will be automatically created."
            className="w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: "-2rem" }}>
      <div className={styles.questionContent}>
        <Accordion
          activeIndex={activeIndex !== null ? activeIndex : undefined}
          onTabChange={(e) => setActiveIndex(typeof e.index === "number" ? e.index : null)}
          className="w-full compact-accordion"
        >
          {blanks.map((blank, index) => (
            <AccordionTab
              key={blank.id}
              header={
                <div className="flex justify-content-between align-items-center w-full">
                  <span className="font-semibold">Answer Field {index + 1}</span>
                  <span className="text-sm text-color-secondary">
                    {blank.graderType === GraderType.STRING
                      ? `String: "${blank.exactMatch || "Not set"}"`
                      : blank.graderType === GraderType.REGEX
                        ? `Regex: "${getRegexDisplayValue(blank) || "Not set"}"`
                        : `Number: ${blank.numberMin || "0"} - ${blank.numberMax || "∞"}`}
                  </span>
                </div>
              }
            >
              <div className="flex flex-column gap-2 p-2">
                <div className="field mb-2">
                  <label htmlFor={`graderType-${index}`} className="text-sm">
                    Grader Type
                  </label>
                  <Dropdown
                    id={`graderType-${index}`}
                    value={blank.graderType}
                    options={graderOptions}
                    onChange={(e) => handleGraderTypeChange(index, e.value)}
                    className="w-full"
                  />
                </div>

                {blank.graderType === GraderType.STRING && (
                  <div className="field mb-2">
                    <label htmlFor={`exactMatch-${index}`} className="text-sm">
                      Exact Match
                    </label>
                    <InputText
                      id={`exactMatch-${index}`}
                      value={blank.exactMatch || ""}
                      onChange={(e) => updateBlank(index, "exactMatch", e.target.value)}
                      className="w-full"
                      placeholder="Exact text to match"
                    />
                  </div>
                )}

                {blank.graderType === GraderType.REGEX && (
                  <div className="field mb-2">
                    <label htmlFor={`regex-${index}`} className="text-sm">
                      Regular Expression
                    </label>
                    <RegexEditor
                      value={getRegexDisplayValue(blank)}
                      onChange={(value) => handleRegexInputChange(index, value)}
                    />
                  </div>
                )}

                {blank.graderType === GraderType.NUMBER && (
                  <div className="flex gap-2 mb-2">
                    <div className="field flex-1">
                      <label htmlFor={`numberMin-${index}`} className="text-sm">
                        Minimum Value
                      </label>
                      <InputText
                        id={`numberMin-${index}`}
                        value={blank.numberMin || ""}
                        onChange={(e) => updateBlank(index, "numberMin", e.target.value)}
                        className="w-full"
                        placeholder="e.g., 0"
                        keyfilter="num"
                      />
                    </div>
                    <div className="field flex-1">
                      <label htmlFor={`numberMax-${index}`} className="text-sm">
                        Maximum Value
                      </label>
                      <InputText
                        id={`numberMax-${index}`}
                        value={blank.numberMax || ""}
                        onChange={(e) => updateBlank(index, "numberMax", e.target.value)}
                        className="w-full"
                        placeholder="e.g., 100"
                        keyfilter="num"
                      />
                    </div>
                  </div>
                )}

                <div className="field mb-2">
                  <label htmlFor={`correctFeedback-${index}`} className="text-sm">
                    Correct Answer Feedback
                  </label>
                  <InputTextarea
                    id={`correctFeedback-${index}`}
                    value={blank.correctFeedback || ""}
                    onChange={(e) => updateBlank(index, "correctFeedback", e.target.value)}
                    rows={1}
                    autoResize
                    className="w-full"
                    placeholder="Feedback shown for correct answers"
                  />
                </div>

                <div className="field mb-1">
                  <label htmlFor={`incorrectFeedback-${index}`} className="text-sm">
                    Incorrect Answer Feedback
                  </label>
                  <InputTextarea
                    id={`incorrectFeedback-${index}`}
                    value={blank.incorrectFeedback || ""}
                    onChange={(e) => updateBlank(index, "incorrectFeedback", e.target.value)}
                    rows={1}
                    autoResize
                    className="w-full"
                    placeholder="Feedback shown for incorrect answers"
                  />
                </div>
              </div>
            </AccordionTab>
          ))}
        </Accordion>

        <div className={styles.questionTips}>
          <i className="pi pi-lightbulb" style={{ marginRight: "4px" }}></i>
          <span>Tip: Click on each answer field to configure validation and feedback.  Type / in the editor for a menu of options.</span>
        </div>
      </div>
    </div>
  );
};
