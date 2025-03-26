import styles from "@components/routes/AssignmentBuilder/AssignmentBuilder.module.css";
import { ErrorState } from "@components/routes/AssignmentBuilder/components/ErrorState/ErrorState";
import { AssignmentExercises } from "@components/routes/AssignmentBuilder/components/exercises/AssignmentExercisesList";
import classNames from "classnames";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { ProgressSpinner } from "primereact/progressspinner";
import { SelectButton } from "primereact/selectbutton";
import { Control, Controller } from "react-hook-form";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { Assignment, KindOfAssignment } from "@/types/assignment";
import { convertDateToISO, convertISOStringToDate } from "@/utils/date";

import { AssignmentReadings } from "../reading/AssignmentReadings";

interface AssignmentEditProps {
  control: Control<Assignment>;
  selectedAssignment: Assignment | null;
  isCollapsed: boolean;
  activeTab: "basic" | "readings" | "exercises";
  onCollapse: () => void;
  onBack: () => void;
  onTabChange: (tab: "basic" | "readings" | "exercises") => void;
  onTypeSelect: (type: KindOfAssignment) => void;
  watch: (name: string) => any;
}

const assignmentTypeCards = [
  {
    type: "Regular" as KindOfAssignment,
    icon: "pi pi-file",
    description: "Standard assignment with exercises and readings"
  },
  {
    type: "Timed" as KindOfAssignment,
    icon: "pi pi-clock",
    description: "Timed quiz or exam with optional pause/feedback settings"
  },
  {
    type: "Peer" as KindOfAssignment,
    icon: "pi pi-users",
    description: "Peer instruction assignment with async options"
  }
];

export const AssignmentEdit = ({
  control,
  selectedAssignment,
  isCollapsed,
  activeTab,
  onCollapse,
  onBack,
  onTabChange,
  onTypeSelect,
  watch
}: AssignmentEditProps) => {
  const { isExercisesError, isExercisesLoading } = useExercisesSelector();

  if (isExercisesError) {
    return (
      <div className="flex flex-column">
        <ErrorState
          title="Unable to Load Assignment"
          //eslint-disable-next-line max-len
          message="We couldn't load your assignment data. This might be due to a temporary issue or network problem. Please try refreshing the page."
        />
      </div>
    );
  }

  if (isExercisesLoading) {
    return (
      <div className="flex flex-columnw h-screen align-items-center justify-center">
        <ProgressSpinner />
      </div>
    );
  }

  return (
    <div className={classNames(styles.layout, { [styles.collapsed]: isCollapsed })}>
      <div className={classNames(styles.sidebar, { [styles.collapsed]: isCollapsed })}>
        <div className={styles.header}>
          <h2 className={styles.title}>Assignment Editor</h2>
          <Button
            icon={isCollapsed ? "pi pi-angle-right" : "pi pi-angle-left"}
            rounded
            text
            severity="secondary"
            onClick={onCollapse}
            tooltip={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            tooltipOptions={{ position: "right" }}
            className={classNames("p-button-sm", styles.collapseButton)}
          />
        </div>
        <div className={styles.navigationTree}>
          <Button
            className={classNames(styles.navigationItem, {
              [styles.active]: activeTab === "basic",
              [styles.collapsed]: isCollapsed
            })}
            onClick={() => onTabChange("basic")}
            tooltip="Basic Info"
            tooltipOptions={{ position: "right", showDelay: 150, hideDelay: 0 }}
            text
          >
            <i className={classNames("pi pi-file", styles.navigationIcon)} />
            <span className={classNames({ [styles.hidden]: isCollapsed })}>Basic Info</span>
          </Button>
          <Button
            className={classNames(styles.navigationItem, {
              [styles.active]: activeTab === "readings",
              [styles.collapsed]: isCollapsed
            })}
            onClick={() => onTabChange("readings")}
            tooltip="Readings"
            tooltipOptions={{ position: "right", showDelay: 150, hideDelay: 0 }}
            text
          >
            <i className={classNames("pi pi-book", styles.navigationIcon)} />
            <span className={classNames({ [styles.hidden]: isCollapsed })}>Readings</span>
          </Button>
          <Button
            className={classNames(styles.navigationItem, {
              [styles.active]: activeTab === "exercises",
              [styles.collapsed]: isCollapsed
            })}
            onClick={() => onTabChange("exercises")}
            tooltip="Exercises"
            tooltipOptions={{ position: "right", showDelay: 150, hideDelay: 0 }}
            text
          >
            <i className={classNames("pi pi-list", styles.navigationIcon)} />
            <span className={classNames({ [styles.hidden]: isCollapsed })}>Exercises</span>
          </Button>
        </div>
      </div>
      <div className={styles.mainContent}>
        <div className={styles.header}>
          <div className="flex align-items-center gap-2">
            <Button icon="pi pi-arrow-left" onClick={onBack} className="p-button-text" />
            <h2>{selectedAssignment?.name}</h2>
          </div>
        </div>
        <div className={styles.mainContentInner}>
          {activeTab === "basic" && (
            <div className={styles.formContainer}>
              <div className={styles.card}>
                <div className={styles.formField}>
                  <label>Assignment Name</label>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <InputText
                        {...field}
                        value={field.value || ""}
                        placeholder="Enter assignment name"
                      />
                    )}
                  />
                </div>
                <div className={styles.formField}>
                  <label>Description</label>
                  <Controller
                    name="description"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                      <InputTextarea
                        {...field}
                        rows={4}
                        placeholder="Enter assignment description"
                      />
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
                          value={convertISOStringToDate(field.value)}
                          onChange={(e) => field.onChange(convertDateToISO(e.value!))}
                          showTime
                          showIcon
                          appendTo={document.body}
                          panelClassName="calendar-panel"
                        />
                      )}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label>Points</label>
                    <Controller
                      name="points"
                      control={control}
                      defaultValue={0}
                      render={({ field }) => (
                        <InputNumber
                          {...field}
                          value={field.value}
                          onValueChange={(e) => field.onChange(e.value)}
                          min={0}
                          disabled
                          mode="decimal"
                          showButtons={false}
                        />
                      )}
                    />
                  </div>
                </div>
                <div className={styles.typeSettings}>
                  <div className={styles.formFields}>
                    <div className={styles.formField}>
                      <label>Assignment Type</label>
                      <Controller
                        name="kind"
                        control={control}
                        render={({ field }) => (
                          <SelectButton
                            value={field.value}
                            onChange={(e) => {
                              field.onChange(e.value);
                              onTypeSelect(e.value);
                            }}
                            options={assignmentTypeCards.map((card) => ({
                              label: card.type,
                              value: card.type
                            }))}
                          />
                        )}
                      />
                    </div>
                    {watch("kind") === "Timed" && (
                      <div className={styles.formField}>
                        <div className={styles.formField}>
                          <label>Time Limit (minutes)</label>
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
                        <div className={styles.formField}>
                          <label>Allow Feedback</label>
                          <Controller
                            name="nofeedback"
                            control={control}
                            render={({ field }) => (
                              <SelectButton
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
                    )}
                    {watch("kind") === "Peer" && (
                      <div className={styles.formField}>
                        <label>Show Async Peer</label>
                        <Controller
                          name="peer_async_visible"
                          control={control}
                          render={({ field }) => (
                            <SelectButton
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
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === "readings" && <AssignmentReadings />}
          {activeTab === "exercises" && <AssignmentExercises />}
        </div>
      </div>
    </div>
  );
};
