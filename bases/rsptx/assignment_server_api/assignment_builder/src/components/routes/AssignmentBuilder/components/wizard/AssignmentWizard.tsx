import { Icon, PrimeIconName } from "@components/ui/Icon";
import {
  Button,
  Checkbox,
  NumberInput,
  SegmentedControl,
  Stepper,
  Textarea,
  TextInput,
  UnstyledButton
} from "@mantine/core";
import classNames from "classnames";
import { Control, Controller, UseFormSetValue, UseFormWatch } from "react-hook-form";

import { Assignment, KindOfAssignment } from "@/types/assignment";

import { DateTimePicker } from "../../../../ui/DateTimePicker";

import { VisibilityControl } from "../edit/VisibilityControl";

import stepperStyles from "@/components/ui/WizardStepper.module.css";

import styles from "./AssignmentWizard.module.css";

const YES_NO_OPTIONS = [
  { label: "Yes", value: "true" },
  { label: "No", value: "false" }
];

const YES_NO_INVERTED_OPTIONS = [
  { label: "Yes", value: "false" },
  { label: "No", value: "true" }
];

const WIZARD_STEPS: ("basic" | "type" | "visibility")[] = ["basic", "type", "visibility"];

const DEFAULT_TIME_LIMIT_MINUTES = 60;

interface AssignmentWizardProps {
  control: Control<Assignment>;
  wizardStep: "basic" | "type" | "visibility";
  nameError: string | null;
  canProceed: boolean;
  isCreating?: boolean;
  onBack: () => void;
  onNext: () => void;
  onComplete: () => void;
  onNameChange: (value: string) => void;
  onTypeSelect: (type: KindOfAssignment) => void;
  watch: UseFormWatch<Assignment>;
  setValue: UseFormSetValue<Assignment>;
}

const wizardSteps = [
  { label: "Basic info" },
  { label: "Assignment type" },
  { label: "Visibility" }
];

const assignmentTypeCards: {
  type: KindOfAssignment;
  icon: PrimeIconName;
  description: string;
  displayName: string;
}[] = [
  {
    type: "Regular",
    icon: "file",
    description: "Standard assignment with exercises and readings",
    displayName: "Regular"
  },
  {
    type: "Timed",
    icon: "clock",
    description: "Quiz or exam with optional pause, feedback, and time settings",
    displayName: "Quiz/Exam"
  },
  {
    type: "Peer",
    icon: "users",
    description: "Peer instruction assignment with async options",
    displayName: "Peer"
  }
];

export const AssignmentWizard = ({
  control,
  wizardStep,
  nameError,
  canProceed,
  isCreating = false,
  onBack,
  onNext,
  onComplete,
  onNameChange,
  onTypeSelect,
  watch,
  setValue
}: AssignmentWizardProps) => {
  const renderBasicInfo = () => (
    <>
      <h1 className={styles.stepTitle}>Basic information</h1>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="wizard-assignment-name">Assignment name</label>
          <Controller
            name="name"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextInput
                {...field}
                id="wizard-assignment-name"
                value={field.value || ""}
                onChange={(e) => {
                  const value = e.target.value;

                  field.onChange(value);
                  onNameChange(value);
                }}
                placeholder="Assignment name"
                error={nameError || undefined}
              />
            )}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="wizard-assignment-description">Description</label>
          <Controller
            name="description"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <Textarea
                {...field}
                id="wizard-assignment-description"
                value={field.value || ""}
                autosize
                minRows={4}
                placeholder="What is this assignment about?"
              />
            )}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="wizard-due-date">Due date</label>
          <Controller
            name="duedate"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <DateTimePicker
                id="wizard-due-date"
                value={field.value}
                onChange={(val) => field.onChange(val)}
              />
            )}
          />
        </div>
      </div>
      <div className={styles.actions}>
        <Button variant="default" leftSection={<Icon name="arrow-left" />} onClick={onBack}>
          Back
        </Button>
        <Button rightSection={<Icon name="arrow-right" />} onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </div>
    </>
  );

  const renderTypeSelection = () => (
    <>
      <h1 className={styles.stepTitle}>Select assignment type</h1>
      <div className={styles.typeCards}>
        {assignmentTypeCards.map((card) => {
          const isSelected = watch("kind") === card.type;

          return (
            <UnstyledButton
              key={card.type}
              className={classNames(styles.typeCard, {
                [styles.typeCardSelected]: isSelected
              })}
              aria-pressed={isSelected}
              onClick={() => onTypeSelect(card.type)}
            >
              <span className={styles.typeIconTile}>
                <Icon name={card.icon} size={22} />
              </span>
              <span className={styles.typeCardBody}>
                <span className={styles.typeCardName}>{card.displayName}</span>
                <span className={styles.typeCardDesc}>{card.description}</span>
              </span>
              {isSelected && (
                <span className={styles.checkBadge} data-testid="type-check-badge">
                  <Icon name="check" size={13} />
                </span>
              )}
            </UnstyledButton>
          );
        })}
      </div>
      {watch("kind") && (
        <div className={styles.typeSettings}>
          {watch("kind") === "Regular" && (
            <>
              <h3 className={styles.settingsTitle}>Regular assignment settings</h3>
              <div className={styles.settingsNote}>No additional options</div>
            </>
          )}

          {watch("kind") === "Timed" && (
            <>
              <h3 className={styles.settingsTitle}>Quiz/Exam settings</h3>
              <div className={styles.settingRows}>
                <div className={styles.settingRow}>
                  <Checkbox
                    label="Time limit"
                    checked={watch("time_limit") !== null}
                    onChange={(e) => {
                      if (e.currentTarget.checked) {
                        setValue("time_limit", DEFAULT_TIME_LIMIT_MINUTES);
                      } else {
                        setValue("time_limit", null);
                      }
                    }}
                  />
                  <Controller
                    name="time_limit"
                    control={control}
                    render={({ field }) => (
                      <NumberInput
                        value={field.value ?? ""}
                        onChange={(val) => field.onChange(val === "" ? null : Number(val))}
                        min={5}
                        max={180}
                        suffix=" min"
                        disabled={field.value === null}
                        w={140}
                        aria-label="Time limit in minutes"
                      />
                    )}
                  />
                </div>
                <div className={styles.settingRow}>
                  <label>Allow pause</label>
                  <Controller
                    name="nopause"
                    control={control}
                    render={({ field }) => (
                      <SegmentedControl
                        value={String(field.value)}
                        onChange={(value) => field.onChange(value === "true")}
                        data={YES_NO_INVERTED_OPTIONS}
                        size="sm"
                        aria-label="Allow pause"
                      />
                    )}
                  />
                </div>
                <div className={styles.settingRow}>
                  <label>Allow feedback</label>
                  <Controller
                    name="nofeedback"
                    control={control}
                    render={({ field }) => (
                      <SegmentedControl
                        value={String(field.value)}
                        onChange={(value) => field.onChange(value === "true")}
                        data={YES_NO_INVERTED_OPTIONS}
                        size="sm"
                        aria-label="Allow feedback"
                      />
                    )}
                  />
                </div>
              </div>
            </>
          )}

          {watch("kind") === "Peer" && (
            <>
              <h3 className={styles.settingsTitle}>Peer instruction settings</h3>
              <div className={styles.settingRows}>
                <div className={styles.settingRow}>
                  <label>Show async peer</label>
                  <Controller
                    name="peer_async_visible"
                    control={control}
                    render={({ field }) => (
                      <SegmentedControl
                        value={String(field.value)}
                        onChange={(value) => field.onChange(value === "true")}
                        data={YES_NO_OPTIONS}
                        size="sm"
                        aria-label="Show async peer"
                      />
                    )}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <div className={styles.actions}>
        <Button variant="default" leftSection={<Icon name="arrow-left" />} onClick={onBack}>
          Back
        </Button>
        <Button rightSection={<Icon name="arrow-right" />} onClick={onNext}>
          Next
        </Button>
      </div>
    </>
  );

  const renderVisibility = () => (
    <>
      <h1 className={styles.stepTitle}>Visibility</h1>
      <p className={styles.visibilityIntro}>
        Control when this assignment becomes visible to students. You can make it visible
        immediately, schedule it for a future date, or set it to hide automatically.
      </p>
      <VisibilityControl control={control} watch={watch} setValue={setValue} />
      <div className={styles.actions}>
        <Button variant="default" leftSection={<Icon name="arrow-left" />} onClick={onBack}>
          Back
        </Button>
        <Button leftSection={<Icon name="check" />} onClick={onComplete} loading={isCreating}>
          Create assignment
        </Button>
      </div>
    </>
  );

  return (
    <div className={styles.wizard}>
      <div className={classNames(styles.stepper, stepperStyles.stepper)}>
        <Stepper active={WIZARD_STEPS.indexOf(wizardStep)} size="sm">
          {wizardSteps.map((step) => (
            <Stepper.Step key={step.label} label={step.label} />
          ))}
        </Stepper>
      </div>
      <div className={styles.card}>
        <div key={wizardStep} className={styles.stepBody}>
          {wizardStep === "basic" && renderBasicInfo()}
          {wizardStep === "type" && renderTypeSelection()}
          {wizardStep === "visibility" && renderVisibility()}
        </div>
      </div>
    </div>
  );
};
