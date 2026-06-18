import { RegexEditor } from "@components/ui/Regex/RegexEditor";
import { Accordion, Alert, Group, Select, Stack, TextInput, Textarea } from "@mantine/core";
import { FC, useEffect, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { DEFAULT_INCORRECT_FEEDBACK } from "@/utils/questionJson";

import styles from "../../../shared/styles/CreateExercise.module.css";
import { BlankWithFeedback, GraderType } from "../types";

import local from "./BlankManager.module.css";

interface BlankManagerProps {
  blanks: BlankWithFeedback[];
  onChange: (blanks: BlankWithFeedback[]) => void;
  questionText: string;
}

const graderOptions = [
  { label: "String match", value: GraderType.STRING },
  { label: "Regular expression", value: GraderType.REGEX },
  { label: "Number range", value: GraderType.NUMBER }
];

const createBlank = (): BlankWithFeedback => ({
  id: `blank-${Date.now()}`,
  graderType: GraderType.STRING,
  exactMatch: "",
  correctFeedback: "Correct",
  incorrectFeedback: DEFAULT_INCORRECT_FEEDBACK
});

export const BlankManager: FC<BlankManagerProps> = ({ blanks, onChange, questionText }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

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

  const updateBlank = (
    index: number,
    field: keyof BlankWithFeedback,
    value: BlankWithFeedback[keyof BlankWithFeedback]
  ) => {
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
          <h3>Answer fields</h3>
        </div>
        <div className={styles.questionContent}>
          <Alert color="blue" variant="light">
            Add {"{blank}"} placeholders in your question text first. Answer fields will be
            automatically created.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className={local.wrapper}>
      <div className={styles.questionContent}>
        <Accordion value={activeId} onChange={setActiveId} variant="separated">
          {blanks.map((blank, index) => (
            <Accordion.Item key={blank.id} value={blank.id}>
              <Accordion.Control>
                <Group justify="space-between" wrap="nowrap">
                  <span className="font-semibold">Answer field {index + 1}</span>
                  <span className={local.headerSummary}>
                    {blank.graderType === GraderType.STRING
                      ? `String: "${blank.exactMatch || "Not set"}"`
                      : blank.graderType === GraderType.REGEX
                        ? `Regex: "${getRegexDisplayValue(blank) || "Not set"}"`
                        : `Number: ${blank.numberMin || "0"} - ${blank.numberMax || "∞"}`}
                  </span>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm" className={local.fieldStack}>
                  <Select
                    id={`graderType-${index}`}
                    label="Grader type"
                    value={blank.graderType}
                    data={graderOptions}
                    allowDeselect={false}
                    onChange={(value) =>
                      handleGraderTypeChange(index, (value as GraderType) || GraderType.STRING)
                    }
                  />

                  {blank.graderType === GraderType.STRING && (
                    <TextInput
                      id={`exactMatch-${index}`}
                      label="Exact match"
                      value={blank.exactMatch || ""}
                      onChange={(e) => updateBlank(index, "exactMatch", e.target.value)}
                      placeholder="Exact text to match"
                    />
                  )}

                  {blank.graderType === GraderType.REGEX && (
                    <div>
                      <label htmlFor={`regex-${index}`} className={local.headerSummary}>
                        Regular expression
                      </label>
                      <RegexEditor
                        value={getRegexDisplayValue(blank)}
                        onChange={(value) => handleRegexInputChange(index, value)}
                      />
                    </div>
                  )}

                  {blank.graderType === GraderType.NUMBER && (
                    <Group grow align="flex-start" wrap="nowrap">
                      <TextInput
                        id={`numberMin-${index}`}
                        label="Minimum value"
                        value={blank.numberMin || ""}
                        onChange={(e) => updateBlank(index, "numberMin", e.target.value)}
                        placeholder="e.g., 0"
                        inputMode="numeric"
                      />
                      <TextInput
                        id={`numberMax-${index}`}
                        label="Maximum value"
                        value={blank.numberMax || ""}
                        onChange={(e) => updateBlank(index, "numberMax", e.target.value)}
                        placeholder="e.g., 100"
                        inputMode="numeric"
                      />
                    </Group>
                  )}

                  <Textarea
                    id={`correctFeedback-${index}`}
                    label="Feedback for correct answer"
                    value={blank.correctFeedback || ""}
                    onChange={(e) => updateBlank(index, "correctFeedback", e.target.value)}
                    autosize
                    minRows={1}
                    placeholder="Feedback shown for correct answers"
                  />

                  <Textarea
                    id={`incorrectFeedback-${index}`}
                    label="Feedback for incorrect answer"
                    value={blank.incorrectFeedback || ""}
                    onChange={(e) => updateBlank(index, "incorrectFeedback", e.target.value)}
                    autosize
                    minRows={1}
                    placeholder="Feedback shown for incorrect answers"
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>

        <Group className={styles.questionTips} gap={6} align="center" wrap="nowrap" mt="md">
          <Icon name="lightbulb" size={14} color="currentColor" />
          <span>
            Tip: Click on each answer field to configure validation and feedback. Type / in the
            editor for a menu of options.
          </span>
        </Group>
      </div>
    </div>
  );
};
