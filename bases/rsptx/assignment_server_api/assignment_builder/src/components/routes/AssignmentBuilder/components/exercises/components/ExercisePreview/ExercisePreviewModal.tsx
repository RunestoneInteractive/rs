import { Dialog } from "primereact/dialog";
import { useState } from "react";
import { MouseEvent } from "react";

import { Exercise } from "@/types/exercises";

import { ExercisePreview } from "./ExercisePreview";

export const ExercisePreviewModal = ({ htmlsrc }: Pick<Exercise, "htmlsrc">) => {
  const [showModal, setShowModal] = useState(false);

  const handleIconClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setShowModal(true);
  };

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      className="flex align-center justify-content-center"
    >
      <i className="pi pi-eye" onClick={handleIconClick} style={{ cursor: "pointer" }} />
      <Dialog
        visible={showModal}
        modal
        contentStyle={{
          display: "flex",
          alignItems: "start",
          justifyContent: "center"
        }}
        onHide={() => setShowModal(false)}
        headerStyle={{ padding: "0.5rem" }}
      >
        <ExercisePreview htmlsrc={htmlsrc} />
      </Dialog>
    </div>
  );
};
