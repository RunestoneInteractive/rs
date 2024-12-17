import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { useState } from "react";

import { Exercise } from "@/types/exercises";

import { ExercisePreview } from "./ExercisePreview";

export const ExercisePreviewModal = ({ htmlsrc }: Pick<Exercise, "htmlsrc">) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      className="flex align-center justify-content-center"
    >
      <Button
        rounded
        icon="pi pi-eye"
        text
        severity="secondary"
        onClick={() => setShowModal(true)}
        tooltip="Preview"
        tooltipOptions={{
          showDelay: 500
        }}
        size="large"
      ></Button>
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
