import { ExercisePreviewModal } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreviewModal";
import { useAssignmentRouting } from "@components/routes/AssignmentBuilder/hooks/useAssignmentRouting";
import { useScrollShadow } from "@components/shell/useScrollShadow";
import { FilterMultiSelect } from "@components/ui/FilterMultiSelect/FilterMultiSelect";
import { Icon } from "@components/ui/Icon";
import { TabToolbar } from "@components/ui/TabToolbar/TabToolbar";
import { TreeTable, TreeTableColumn } from "@components/ui/TreeTable";
import { ActionIcon, Button, Group, Switch, Text, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  chooseExercisesActions,
  chooseExercisesSelectors
} from "@store/chooseExercises/chooseExercises.logic";
import { datasetSelectors } from "@store/dataset/dataset.logic";
import { exercisesSelectors } from "@store/exercises/exercises.logic";
import { differenceBy } from "lodash";
import uniqBy from "lodash/uniqBy";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";
import { Exercise } from "@/types/exercises";
import { TreeNode } from "@/types/treeNode";
import {
  getLeafNodes,
  getSelectedKeys,
  filterExercisesByQuestionType,
  filterOutExercisesByQuestionType,
  filterExercisesByFromSource
} from "@/utils/exercise";

import styles from "./ChooseExercises.module.css";

const buildChangesSummary = (toAdd: number, toRemove: number): string => {
  const parts = [];

  if (toAdd) {
    parts.push(`${toAdd} to add`);
  }
  if (toRemove) {
    parts.push(`${toRemove} to remove`);
  }
  return parts.length ? parts.join(" · ") : "No changes yet";
};

const exerciseNoun = (count: number) => (count === 1 ? "exercise" : "exercises");

export const getApplyChangesConfirmMessage = (toAdd: number, toRemove: number): string => {
  if (toAdd && toRemove) {
    return `Add ${toAdd} and remove ${toRemove} ${exerciseNoun(toRemove)} in this assignment?`;
  }
  if (toAdd) {
    return `Add ${toAdd} ${exerciseNoun(toAdd)} to this assignment?`;
  }
  return `Remove ${toRemove} ${exerciseNoun(toRemove)} from this assignment?`;
};

export const ChooseExercises = () => {
  const dispatch = useDispatch();
  const { assignmentExercises = [] } = useExercisesSelector();
  const availableExercises = useSelector(exercisesSelectors.getAvailableExercises);
  const questionTypeOptions = useSelector(datasetSelectors.getQuestionTypeOptions);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>([]);
  const [fromSourceOnly, setFromSourceOnly] = useState<boolean>(false);
  const { sentinelRef, scrolled } = useScrollShadow();

  const selectedKeys = useSelector(chooseExercisesSelectors.getSelectedKeys);
  const selectedExercises = useSelector(chooseExercisesSelectors.getSelectedExercises);
  const exercisesToAdd = useSelector(chooseExercisesSelectors.getExercisesToAdd);
  const exercisesToRemove = useSelector(chooseExercisesSelectors.getExercisesToRemove);

  const { updateAssignmentExercises } = useUpdateAssignmentExercise();
  const { navigateToExercises, updateExerciseViewMode } = useAssignmentRouting();
  const { selectedAssignment } = useSelectedAssignment();

  const filteredExercises = filterExercisesByFromSource(
    filterOutExercisesByQuestionType(
      filterExercisesByQuestionType(availableExercises, selectedQuestionTypes),
      ["datafile"]
    ),
    fromSourceOnly
  );

  const updateState = (selEx: Exercise[]) => {
    dispatch(chooseExercisesActions.setSelectedExercises(selEx));

    dispatch(
      chooseExercisesActions.setSelectedKeys({
        ...selectedKeys,
        ...getSelectedKeys(filteredExercises, selEx)
      })
    );

    dispatch(
      chooseExercisesActions.setExercisesToAdd(
        differenceBy(selEx, assignmentExercises, (ex) => ex.question_id || ex.id)
      )
    );

    dispatch(
      chooseExercisesActions.setExercisesToRemove(
        differenceBy(assignmentExercises, selEx, (ex) => ex.question_id || ex.id)
      )
    );
  };

  const resetSelections = () => {
    dispatch(
      chooseExercisesActions.setSelectedKeys(
        getSelectedKeys(filteredExercises, assignmentExercises)
      )
    );
    dispatch(chooseExercisesActions.setSelectedExercises(assignmentExercises));
    dispatch(chooseExercisesActions.resetSelections());
  };

  const getExerciseId = (exercise: Exercise) => {
    return exercise.question_id || exercise.id;
  };

  const handleSelect = (node: TreeNode) => {
    const entriesToAdd = getLeafNodes([node]).map((x) => x.data as Exercise);

    const updatedSelectedExercises = uniqBy([...selectedExercises, ...entriesToAdd], (n) =>
      getExerciseId(n)
    );

    updateState(updatedSelectedExercises);
  };

  const handleUnselect = (node: TreeNode) => {
    const entriesToRemove = getLeafNodes([node]).map((x) => x.data as Exercise);

    const updatedSelectedExercises = selectedExercises.filter(
      (x) => !entriesToRemove.some((y) => getExerciseId(x) === y.id)
    );

    updateState(updatedSelectedExercises);
  };

  const hasAnyChanges = !!exercisesToAdd.length || !!exercisesToRemove.length;

  const handleBackToList = () => {
    resetSelections();
    updateExerciseViewMode("list");
  };

  const onApplyClick = () => {
    if (!selectedAssignment) {
      console.error("ChooseExercises: No selected assignment");
      return;
    }

    modals.openConfirmModal({
      title: "Apply changes",
      children: (
        <Text size="sm">
          {getApplyChangesConfirmMessage(exercisesToAdd.length, exercisesToRemove.length)}
        </Text>
      ),
      labels: { confirm: "Apply", cancel: "Cancel" },
      onConfirm: async () => {
        await updateAssignmentExercises({
          idsToAdd: exercisesToAdd.map((x) => x.id),
          idsToRemove: exercisesToRemove.map((x) => x.id),
          isReading: false
        });
        navigateToExercises(selectedAssignment.id.toString());
      }
    });
  };

  const columns: TreeTableColumn[] = [
    {
      header: "Select exercises",
      width: "45%",
      render: (node) => <span>{(node.data as Exercise)?.title}</span>
    },
    {
      header: "Number",
      width: "15%",
      render: (node) => <span>{(node.data as Exercise)?.qnumber}</span>
    },
    {
      header: "Name",
      width: "20%",
      render: (node) => <span>{(node.data as Exercise)?.name}</span>
    },
    {
      header: "Preview",
      width: "6rem",
      render: (node) => {
        const data = node.data as Exercise;

        if (!data?.htmlsrc) {
          return null;
        }
        return (
          <ExercisePreviewModal
            htmlsrc={data.htmlsrc}
            questionName={data.name}
            triggerButton={
              <ActionIcon variant="subtle" color="gray" size={40} aria-label="Preview exercise">
                <Icon name="eye" />
              </ActionIcon>
            }
          />
        );
      }
    },
    {
      header: "Type",
      width: "15%",
      render: (node) => <span>{(node.data as Exercise)?.question_type}</span>
    },
    {
      header: "Source",
      width: "10%",
      render: (node) => {
        const data = node.data as Exercise;

        if (data?.from_source === undefined) {
          return null;
        }
        const sourceLabel = data.from_source ? "From book" : "User created";

        return (
          <Tooltip
            label={sourceLabel}
            position="top"
            events={{ hover: true, focus: true, touch: true }}
          >
            <ActionIcon variant="subtle" color="gray" size={40} aria-label={sourceLabel}>
              <Icon name={data.from_source ? "book" : "user"} />
            </ActionIcon>
          </Tooltip>
        );
      }
    }
  ];

  return (
    <section className={styles.card} aria-label="Choose exercises">
      <TabToolbar
        title="Choose from book"
        count={selectedExercises.length}
        scrolled={scrolled}
        leading={
          <Tooltip label="Back to exercises" position="bottom" openDelay={500}>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={handleBackToList}
              aria-label="Back to exercises"
            >
              <Icon name="arrow-left" />
            </ActionIcon>
          </Tooltip>
        }
      >
        <Switch
          size="sm"
          label={fromSourceOnly ? "Book exercises" : "All exercises"}
          labelPosition="left"
          checked={fromSourceOnly}
          onChange={(e) => setFromSourceOnly(e.currentTarget.checked)}
        />
        <FilterMultiSelect
          label="Exercise types"
          options={questionTypeOptions}
          value={selectedQuestionTypes}
          onChange={setSelectedQuestionTypes}
        />
      </TabToolbar>
      <div className={styles.treeWrap}>
        <TreeTable
          value={filteredExercises}
          columns={columns}
          selectionKeys={selectedKeys}
          onSelect={handleSelect}
          onUnselect={handleUnselect}
          ariaLabel="Choose exercises"
          scrollSentinelRef={sentinelRef}
          getNodeLabel={(node) => (node.data as Exercise)?.title ?? String(node.key)}
        />
      </div>
      <div className={styles.footer}>
        <span className={styles.footerCount}>
          {buildChangesSummary(exercisesToAdd.length, exercisesToRemove.length)}
        </span>
        <Group gap="xs">
          <Button size="xs" variant="subtle" disabled={!hasAnyChanges} onClick={resetSelections}>
            Reset
          </Button>
          <Button size="xs" variant="default" onClick={handleBackToList}>
            Cancel
          </Button>
          <Button size="xs" disabled={!hasAnyChanges} onClick={onApplyClick}>
            Apply changes
          </Button>
        </Group>
      </div>
    </section>
  );
};
