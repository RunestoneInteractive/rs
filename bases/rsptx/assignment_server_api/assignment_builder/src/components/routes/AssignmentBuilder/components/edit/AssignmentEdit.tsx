import { ErrorState } from "@components/routes/AssignmentBuilder/components/ErrorState/ErrorState";
import { AssignmentExercises } from "@components/routes/AssignmentBuilder/components/exercises/AssignmentExercisesList";
import { Icon } from "@components/ui/Icon";
import {
  ActionIcon,
  Center,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Paper,
  SegmentedControl,
  Textarea,
  TextInput,
  Tooltip,
  UnstyledButton
} from "@mantine/core";
import classNames from "classnames";
import { Control, Controller, UseFormSetValue } from "react-hook-form";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { Assignment, KindOfAssignment } from "@/types/assignment";

import { DateTimePicker } from "../../../../ui/DateTimePicker";

import { AssignmentReadings } from "../reading/AssignmentReadings";
import { VisibilityControl } from "./VisibilityControl";

import styles from "./AssignmentEdit.module.css";

const YES_NO_OPTIONS = [
  { label: "Yes", value: "true" },
  { label: "No", value: "false" }
];

const YES_NO_INVERTED_OPTIONS = [
  { label: "Yes", value: "false" },
  { label: "No", value: "true" }
];

const DEFAULT_TIME_LIMIT_MINUTES = 60;

interface AssignmentEditProps {
  control: Control<Assignment>;
  selectedAssignment: Assignment | null;
  isCollapsed: boolean;
  activeTab: "basic" | "readings" | "exercises";
  onCollapse: () => void;
  onBack: () => void;
  onTabChange: (tab: "basic" | "readings" | "exercises") => void;
  onTypeSelect: (type: KindOfAssignment) => void;
  watch: (name: string) => unknown;
  setValue: UseFormSetValue<Assignment>;
}

const ASSIGNMENT_TYPES: KindOfAssignment[] = ["Regular", "Timed", "Peer"];

export const AssignmentEdit = ({
  control,
  selectedAssignment,
  isCollapsed,
  activeTab,
  onCollapse,
  onBack,
  onTabChange,
  onTypeSelect,
  watch,
  setValue
}: AssignmentEditProps) => {
  const { isExercisesError, isExercisesLoading } = useExercisesSelector();

  if (isExercisesError) {
    return <ErrorState title="Couldn't load this assignment" message="Refresh the page." />;
  }

  if (isExercisesLoading) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  const navItems: {
    tab: "basic" | "readings" | "exercises";
    label: string;
    icon: "file" | "book" | "list";
  }[] = [
    { tab: "basic", label: "Basic info", icon: "file" },
    { tab: "readings", label: "Readings", icon: "book" },
    { tab: "exercises", label: "Exercises", icon: "list" }
  ];

  const kind = watch("kind") as KindOfAssignment | undefined;

  const renderDetailsSection = () => (
    <Paper className={styles.section}>
      <h3 className={styles.sectionTitle}>Details</h3>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="edit-assignment-name">Assignment name</label>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextInput
                {...field}
                id="edit-assignment-name"
                value={field.value || ""}
                placeholder="Assignment name"
              />
            )}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="edit-assignment-description">Description</label>
          <Controller
            name="description"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <Textarea
                {...field}
                id="edit-assignment-description"
                value={field.value || ""}
                autosize
                minRows={4}
                placeholder="What is this assignment about?"
              />
            )}
          />
        </div>
        <div className={styles.field}>
          <label>Assignment type</label>
          <Controller
            name="kind"
            control={control}
            render={({ field }) => (
              <SegmentedControl
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  onTypeSelect(value as KindOfAssignment);
                }}
                data={ASSIGNMENT_TYPES.map((type) => ({ label: type, value: type }))}
                aria-label="Assignment type"
              />
            )}
          />
        </div>
      </div>
    </Paper>
  );

  const renderScheduleSection = () => (
    <Paper className={styles.section}>
      <h3 className={styles.sectionTitle}>Schedule</h3>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="edit-due-date">Due date</label>
          <Controller
            name="duedate"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <DateTimePicker
                id="edit-due-date"
                value={field.value}
                onChange={(val) => field.onChange(val)}
              />
            )}
          />
        </div>
        {kind === "Timed" && (
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
        )}
      </div>
    </Paper>
  );

  const renderScoringSection = () => (
    <Paper className={styles.section}>
      <h3 className={styles.sectionTitle}>Scoring</h3>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="edit-points">Points</label>
          <Controller
            name="points"
            control={control}
            defaultValue={0}
            render={({ field }) => (
              <NumberInput
                id="edit-points"
                value={field.value ?? 0}
                onChange={(val) => field.onChange(val)}
                min={0}
                disabled
                hideControls
              />
            )}
          />
        </div>
      </div>
    </Paper>
  );

  const renderBehaviorSection = () => (
    <Paper className={styles.section}>
      <h3 className={styles.sectionTitle}>Behavior</h3>
      <div className={styles.fields}>
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
    </Paper>
  );

  const renderPeerSection = () => (
    <Paper className={styles.section}>
      <h3 className={styles.sectionTitle}>Peer settings</h3>
      <div className={styles.fields}>
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
    </Paper>
  );

  const renderVisibilitySection = () => (
    <Paper className={styles.section}>
      <h3 className={styles.sectionTitle}>Visibility</h3>
      <VisibilityControl control={control} watch={watch} setValue={setValue} />
    </Paper>
  );

  return (
    <div className={styles.layout}>
      <nav
        className={classNames(styles.rail, { [styles.railCollapsed]: isCollapsed })}
        aria-label="Assignment editor sections"
      >
        <div className={styles.railHeader}>
          {!isCollapsed && <span className={styles.railTitle}>Assignment editor</span>}
          <Tooltip label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} position="right">
            <ActionIcon
              variant="subtle"
              color="gray"
              radius="xl"
              size={40}
              onClick={onCollapse}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icon name={isCollapsed ? "angle-right" : "angle-left"} />
            </ActionIcon>
          </Tooltip>
        </div>
        {navItems.map((item) => (
          <Tooltip
            key={item.tab}
            label={item.label}
            position="right"
            openDelay={150}
            disabled={!isCollapsed}
          >
            <UnstyledButton
              className={classNames(styles.navItem, {
                [styles.navItemActive]: activeTab === item.tab,
                [styles.navItemCollapsed]: isCollapsed
              })}
              aria-label={item.label}
              aria-current={activeTab === item.tab ? "true" : undefined}
              onClick={() => onTabChange(item.tab)}
            >
              <span className={styles.navIcon}>
                <Icon name={item.icon} size={18} />
              </span>
              {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
            </UnstyledButton>
          </Tooltip>
        ))}
      </nav>
      <div className={styles.main}>
        <div className={styles.mainHeader}>
          <Group align="center" gap="xs" justify="space-between" w="100%" wrap="nowrap">
            <Group align="center" gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={40}
                onClick={onBack}
                aria-label="Back"
              >
                <Icon name="arrow-left" />
              </ActionIcon>
              <h1 className={styles.assignmentName} title={selectedAssignment?.name}>
                {selectedAssignment?.name}
              </h1>
            </Group>
            <Tooltip label="Preview as student" position="bottom">
              <ActionIcon
                variant="subtle"
                color="gray"
                size={40}
                aria-label="Preview as student"
                disabled={!selectedAssignment?.id}
                onClick={() => {
                  if (!selectedAssignment?.id) return;
                  const { protocol, hostname } = window.location;
                  const previewUrl = `${protocol}//${hostname}/assignment/student/doAssignment?assignment_id=${selectedAssignment.id}`;

                  window.open(previewUrl, "_blank");
                }}
              >
                <Icon name="eye" />
              </ActionIcon>
            </Tooltip>
          </Group>
        </div>
        <div className={styles.mainScroll}>
          {activeTab === "basic" && (
            <div className={styles.sections}>
              {renderDetailsSection()}
              {renderScheduleSection()}
              {renderScoringSection()}
              {kind === "Timed" && renderBehaviorSection()}
              {kind === "Peer" && renderPeerSection()}
              {renderVisibilitySection()}
            </div>
          )}
          {activeTab === "readings" && <AssignmentReadings />}
          {activeTab === "exercises" && <AssignmentExercises />}
        </div>
      </div>
    </div>
  );
};
