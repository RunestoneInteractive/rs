import { Icon } from "@components/ui/Icon";
import { SearchInput } from "@components/ui/SearchInput";
import { TabToolbar } from "@components/ui/TabToolbar/TabToolbar";
import { ActionIcon, Button, Text } from "@mantine/core";
import { modals } from "@mantine/modals";

import { Exercise } from "@/types/exercises";

import { ChooseReadingsButton } from "./components/ChooseReadingsButton";

import styles from "./ReadingsToolbar.module.css";

const TITLE = "Sections to read";

interface ReadingsToolbarProps {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  totalCount: number;
  selectedReadings: Exercise[];
  handleRemoveSelected: () => void;
  scrolled?: boolean;
}

export const ReadingsToolbar = ({
  globalFilter,
  setGlobalFilter,
  totalCount,
  selectedReadings,
  handleRemoveSelected,
  scrolled = false
}: ReadingsToolbarProps) => {
  const onInfoClick = () => {
    modals.open({
      size: "50vw",
      title: TITLE,
      children: (
        <Text size="sm">
          Reading assignments are meant to encourage students to do the reading, by giving them
          points for interacting with various interactive elements that are a part of the page. The
          number of activities required is set to 80% of the number of questions in the reading.
          Reading assignments are meant to be <strong>formative</strong> and therefore the questions
          are not graded for correctness, rather the students are given points for interacting with
          them.
        </Text>
      )
    });
  };

  const onRemoveClick = () => {
    modals.openConfirmModal({
      title: "Remove readings",
      children: (
        <Text size="sm">
          Remove {selectedReadings.length} {selectedReadings.length === 1 ? "reading" : "readings"}{" "}
          from this assignment?
        </Text>
      ),
      labels: { confirm: "Remove", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: handleRemoveSelected
    });
  };

  return (
    <TabToolbar
      title={TITLE}
      count={totalCount}
      scrolled={scrolled}
      titleExtra={
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onInfoClick}
          aria-label="Reading information"
        >
          <Icon name="info-circle" size={16} />
        </ActionIcon>
      }
    >
      <SearchInput
        value={globalFilter}
        onChange={setGlobalFilter}
        placeholder="Search readings…"
        className={styles.search}
      />
      <ChooseReadingsButton />
      <Button
        variant="outline"
        color="red"
        leftSection={<Icon name="trash" size={16} />}
        disabled={!selectedReadings.length}
        onClick={onRemoveClick}
      >
        {selectedReadings.length ? `Remove (${selectedReadings.length})` : "Remove"}
      </Button>
    </TabToolbar>
  );
};
