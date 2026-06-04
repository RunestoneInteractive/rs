import { Icon } from "@components/ui/Icon";
import { TreeTable, TreeTableColumn } from "@components/ui/TreeTable";
import { Button, Popover } from "@mantine/core";
import { readingsSelectors } from "@store/readings/readings.logic";
import { useState } from "react";
import { useSelector } from "react-redux";

import { useReadingsSelector } from "@/hooks/useReadingsSelector";
import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";
import { Exercise } from "@/types/exercises";
import { TreeNode } from "@/types/treeNode";
import { getLeafNodes } from "@/utils/exercise";

import styles from "./ChooseReadingsButton.module.css";

const READINGS_COLUMNS: TreeTableColumn[] = [
  {
    header: "Select readings",
    render: (node) => <span>{(node.data as Exercise)?.title}</span>
  }
];

export const ChooseReadingsButton = () => {
  const [opened, setOpened] = useState(false);
  const { selectedKeys = {}, readingExercises = [] } = useReadingsSelector();
  const availableReadings = useSelector(readingsSelectors.getAvailableReadings);
  const { updateAssignmentExercises, isUpdating } = useUpdateAssignmentExercise();

  const onSelect = async (node: TreeNode) => {
    if (isUpdating) {
      return;
    }
    const entriesToAdd = getLeafNodes([node]).map((x) => x.data as Exercise);

    await updateAssignmentExercises({
      idsToAdd: entriesToAdd.map((x) => x.id),
      isReading: true
    });
  };

  const onUnselect = async (node: TreeNode) => {
    if (isUpdating) {
      return;
    }
    const entriesToRemove = getLeafNodes([node]).map((x) => x.data as Exercise);
    const entriesIdsToRemove = entriesToRemove.map((x) => x.id);
    const idsToRemove = readingExercises
      .filter((ex) => entriesIdsToRemove.includes(ex.question_id))
      .map((x) => x.id);

    await updateAssignmentExercises({
      idsToRemove,
      isReading: true
    });
  };

  const selectedCount = readingExercises.length;

  return (
    <Popover
      width={480}
      classNames={{ dropdown: styles.dropdown }}
      position="bottom-end"
      opened={opened}
      onChange={setOpened}
      trapFocus
      returnFocus
    >
      <Popover.Target>
        <Button
          leftSection={<Icon name="book" size={16} />}
          onClick={() => setOpened((value) => !value)}
        >
          Choose readings
        </Button>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div className={styles.treeWrap} aria-busy={isUpdating}>
          <TreeTable
            value={availableReadings}
            columns={READINGS_COLUMNS}
            selectionKeys={selectedKeys}
            onSelect={onSelect}
            onUnselect={onUnselect}
            ariaLabel="Choose readings"
            getNodeLabel={(node) => (node.data as Exercise)?.title ?? String(node.key)}
          />
        </div>
        <div className={styles.footer}>
          <span className={styles.footerCount}>
            {selectedCount === 1 ? "1 section selected" : `${selectedCount} sections selected`}
          </span>
          <Button size="xs" variant="default" onClick={() => setOpened(false)}>
            Done
          </Button>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
};
