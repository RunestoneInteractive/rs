import { Dialog } from "primereact/dialog";
import { useState, cloneElement, MouseEvent, ReactElement } from "react";

import { Exercise } from "@/types/exercises";

import { ExercisePreview } from "./ExercisePreview";

type ExercisePreviewModalProps = Pick<Exercise, "htmlsrc"> & {
  triggerButton: ReactElement;
};

export const ExercisePreviewModal = ({ htmlsrc, triggerButton }: ExercisePreviewModalProps) => {
  const [showModal, setShowModal] = useState(false);

  const handleIconClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setShowModal(true);
  };

  const buttonWithHandler = cloneElement(triggerButton, { onClick: handleIconClick });

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      className="flex align-center justify-content-center"
    >
      {buttonWithHandler}
      <Dialog
        visible={showModal}
        modal
        contentStyle={{ display: "flex", alignItems: "start", justifyContent: "center" }}
        onHide={() => setShowModal(false)}
        headerStyle={{ padding: "0.5rem" }}
      >
        <ExercisePreview htmlsrc={htmlsrc} />
      </Dialog>
    </div>
  );
};
