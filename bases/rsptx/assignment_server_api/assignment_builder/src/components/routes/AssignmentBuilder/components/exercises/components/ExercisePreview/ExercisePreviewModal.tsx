import { Modal } from "@mantine/core";
import { useState, cloneElement, MouseEvent, ReactElement } from "react";

import { Exercise } from "@/types/exercises";

import { ExercisePreview } from "./ExercisePreview";

import styles from "./ExercisePreviewModal.module.css";

type ExercisePreviewModalProps = Pick<Exercise, "htmlsrc"> & {
  triggerButton: ReactElement;
  questionName?: string;
};

export const ExercisePreviewModal = ({
  htmlsrc,
  triggerButton,
  questionName
}: ExercisePreviewModalProps) => {
  const [showModal, setShowModal] = useState(false);

  const handleIconClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setShowModal(true);
  };

  const buttonWithHandler = cloneElement(triggerButton, { onClick: handleIconClick });

  return (
    <>
      {buttonWithHandler}
      <Modal
        opened={showModal}
        onClose={() => setShowModal(false)}
        size="auto"
        centered
        title={questionName ? <span className={styles.nameChip}>{questionName}</span> : undefined}
      >
        <div className={styles.stage}>
          <ExercisePreview htmlsrc={htmlsrc} />
        </div>
      </Modal>
    </>
  );
};
