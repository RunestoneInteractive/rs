import { Icon } from "@components/ui/Icon";
import { SearchInput } from "@components/ui/SearchInput";
import { TabToolbar } from "@components/ui/TabToolbar/TabToolbar";
import { Button, Menu, Text } from "@mantine/core";
import { modals } from "@mantine/modals";

import { Exercise } from "@/types/exercises";

import { ViewModeSetter } from "./types";

import styles from "./ExercisesToolbar.module.css";

interface ExercisesToolbarProps {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  totalCount: number;
  selectedExercises: Exercise[];
  handleRemoveSelected: () => void;
  setViewMode: ViewModeSetter;
  setResetExerciseForm: (reset: boolean) => void;
  scrolled?: boolean;
}

export const ExercisesToolbar = ({
  globalFilter,
  setGlobalFilter,
  totalCount,
  selectedExercises,
  handleRemoveSelected,
  setViewMode,
  setResetExerciseForm,
  scrolled = false
}: ExercisesToolbarProps) => {
  const onRemoveClick = () => {
    modals.openConfirmModal({
      title: "Remove exercises",
      children: (
        <Text size="sm">
          Remove {selectedExercises.length}{" "}
          {selectedExercises.length === 1 ? "exercise" : "exercises"} from this assignment?
        </Text>
      ),
      labels: { confirm: "Remove", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: handleRemoveSelected
    });
  };

  return (
    <TabToolbar title="Exercises" count={totalCount} scrolled={scrolled}>
      <SearchInput
        value={globalFilter}
        onChange={setGlobalFilter}
        placeholder="Search exercises…"
        className={styles.search}
      />
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Button leftSection={<Icon name="plus" size={16} />}>Add exercise</Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<Icon name="book" size={16} />}
            onClick={() => setViewMode("browse")}
          >
            Choose from book
          </Menu.Item>
          <Menu.Item
            leftSection={<Icon name="search" size={16} />}
            onClick={() => setViewMode("search")}
          >
            Search exercises
          </Menu.Item>
          <Menu.Item
            leftSection={<Icon name="plus" size={16} />}
            onClick={() => {
              setResetExerciseForm(true);
              setViewMode("create");
            }}
          >
            Create exercise
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Button
        variant="outline"
        color="red"
        leftSection={<Icon name="trash" size={16} />}
        disabled={!selectedExercises.length}
        onClick={onRemoveClick}
      >
        {selectedExercises.length ? `Remove (${selectedExercises.length})` : "Remove"}
      </Button>
    </TabToolbar>
  );
};
