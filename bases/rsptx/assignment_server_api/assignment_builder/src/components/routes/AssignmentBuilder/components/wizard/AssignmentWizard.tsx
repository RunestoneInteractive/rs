import classNames from "classnames";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Card } from "primereact/card";
import { Checkbox } from "primereact/checkbox";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { SelectButton } from "primereact/selectbutton";
import { Steps } from "primereact/steps";
import { Control, Controller, UseFormSetValue } from "react-hook-form";

import { Assignment, KindOfAssignment } from "@/types/assignment";
import { convertDateToISO } from "@/utils/date";

// eslint-disable-next-line no-restricted-imports
import styles from "../../AssignmentBuilder.module.css";

interface AssignmentWizardProps {
  control: Control<Assignment>;
  wizardStep: "basic" | "type";
  nameError: string | null;
  canProceed: boolean;
  onBack: () => void;
  onNext: () => void;
  onComplete: () => void;
  onNameChange: (value: string) => void;
  onTypeSelect: (type: KindOfAssignment) => void;
  watch: (name: string) => any;
  setValue: UseFormSetValue<Assignment>;
}

const wizardSteps = [{ label: "Basic Info" }, { label: "Assignment Type" }];

const assignmentTypeCards = [
  {
    type: "Regular" as KindOfAssignment,
    icon: "pi pi-file",
    description: "Standard assignment with exercises and readings",
    displayName: "Regular"
  },
  {
    type: "Timed" as KindOfAssignment,
    icon: "pi pi-clock",
    description: "Quiz or Exam with optional pause, feedback and time settings",
    displayName: "Quiz/Exam"
  },
  {
    type: "Peer" as KindOfAssignment,
    icon: "pi pi-users",
    description: "Peer instruction assignment with async options",
    displayName: "Peer"
  }
];

export const AssignmentWizard = ({
  control,
  wizardStep,
  nameError,
  canProceed,
  onBack,
  onNext,
  onComplete,
  onNameChange,
  onTypeSelect,
  watch,
  setValue
}: AssignmentWizardProps) => {
  const renderBasicInfo = () => (
    <div className={styles.wizardStep}>
      <h2>Basic Information</h2>
      <div className={styles.wizardStepContent}>
        <div className={styles.formField}>
          <label>Assignment Name</label>
          <Controller
            name="name"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <InputText
                {...field}
                value={field.value || ""}
                onChange={(e) => {
                  const value = e.target.value;

                  field.onChange(value);
                  onNameChange(value);
                }}
                placeholder="Enter assignment name"
                className={nameError ? "p-invalid" : ""}
              />
            )}
          />
          {nameError && <small className="p-error">{nameError}</small>}
        </div>
        <div className={styles.formField}>
          <label>Description</label>
          <Controller
            name="description"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <InputTextarea {...field} rows={4} placeholder="Enter assignment description" />
            )}
          />
        </div>
        <div className={styles.formFieldRow}>
          <div className={styles.formField}>
            <label>Due Date</label>
            <Controller
              name="duedate"
              control={control}
              defaultValue=""
              render={({ field }) => (
                <Calendar
                  hideOnDateTimeSelect
                  dateFormat="dd/mm/yy"
                  stepMinute={5}
                  value={field.value ? new Date(field.value) : null}
                  onChange={(e) => field.onChange(convertDateToISO(e.value!))}
                  showTime
                  showIcon
                  // appendTo={document.body}
                  panelClassName="calendar-panel"
                />
              )}
            />
          </div>
        </div>
      </div>
      <div className={styles.wizardActions}>
        <Button
          label="Back"
          icon="pi pi-arrow-left"
          onClick={onBack}
          className="p-button-secondary"
        />
        <Button label="Next" icon="pi pi-arrow-right" onClick={onNext} disabled={!canProceed} />
      </div>
    </div>
  );

  const renderTypeSelection = () => (
    <div className={styles.wizardStep}>
      <h2>Select Assignment Type</h2>
      <div className={styles.wizardStepContent}>
        <div className={styles.typeCards}>
          {assignmentTypeCards.map((card) => (
            <Card
              key={card.type}
              className={classNames(styles.typeCard, {
                [styles.selected]: watch("kind") === card.type
              })}
              onClick={() => onTypeSelect(card.type)}
            >
              <i className={card.icon} />
              <div className={styles.typeCardContent}>
                <h3>{card.displayName}</h3>
                <p>{card.description}</p>
              </div>
            </Card>
          ))}
        </div>
        {watch("kind") && (
          <div className={classNames(styles.typeSettings)}>
            {watch("kind") === "Regular" && (
              <>
                <h3>Regular Assignment Settings</h3>
                <div className={styles.formFields}>No additional options</div>
              </>
            )}

            {watch("kind") === "Timed" && (
              <>
                <h3>Quiz/Exam Settings</h3>
                <div className={styles.formFields} style={{ flexDirection: "row" }}>
                  <div className={styles.formField}>
                    <label>Timed</label>
                    <Checkbox
                      checked={watch("time_limit") !== null}
                      onChange={(e) => {
                        if (e.checked) {
                          setValue("time_limit", 60);
                        } else {
                          setValue("time_limit", null);
                        }
                      }}
                    />
                    <label>Time Limit</label>
                    <Controller
                      name="time_limit"
                      control={control}
                      render={({ field }) => (
                        <InputNumber
                          value={field.value}
                          onValueChange={(e) => field.onChange(e.value)}
                          min={5}
                          max={180}
                          showButtons
                          size={5}
                          suffix=" min"
                          disabled={field.value === null}
                        />
                      )}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label>Allow Pause</label>
                    <Controller
                      name="nopause"
                      control={control}
                      render={({ field }) => (
                        <SelectButton
                          allowEmpty={false}
                          value={field.value}
                          onChange={(e) => field.onChange(e.value)}
                          options={[
                            { label: "Yes", value: false },
                            { label: "No", value: true }
                          ]}
                          className="p-buttonset-sm"
                        />
                      )}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label>Allow Feedback</label>
                    <Controller
                      name="nofeedback"
                      control={control}
                      render={({ field }) => (
                        <SelectButton
                          allowEmpty={false}
                          value={field.value}
                          onChange={(e) => field.onChange(e.value)}
                          options={[
                            { label: "Yes", value: false },
                            { label: "No", value: true }
                          ]}
                          className="p-buttonset-sm"
                        />
                      )}
                    />
                  </div>
                </div>
              </>
            )}

            {watch("kind") === "Peer" && (
              <>
                <h3>Peer Instruction Settings</h3>
                <div className={styles.formFields}>
                  <div className={styles.formField}>
                    <label>Show Async Peer</label>
                    <Controller
                      name="peer_async_visible"
                      control={control}
                      render={({ field }) => (
                        <SelectButton
                          allowEmpty={false}
                          value={field.value}
                          onChange={(e) => field.onChange(e.value)}
                          options={[
                            { label: "Yes", value: true },
                            { label: "No", value: false }
                          ]}
                          className="p-buttonset-sm"
                        />
                      )}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <div className={styles.wizardActions}>
        <Button
          label="Back"
          icon="pi pi-arrow-left"
          onClick={onBack}
          className="p-button-secondary"
        />
        <Button label="Create" icon="pi pi-check" onClick={onComplete} />
      </div>
    </div>
  );

  return (
    <div className={styles.wizard}>
      <Steps
        model={wizardSteps}
        activeIndex={wizardSteps.findIndex((s) => {
          switch (wizardStep) {
            case "basic":
              return s.label === "Basic Info";
            case "type":
              return s.label === "Assignment Type";
            default:
              return false;
          }
        })}
      />
      {wizardStep === "basic" && renderBasicInfo()}
      {wizardStep === "type" && renderTypeSelection()}
    </div>
  );
};
