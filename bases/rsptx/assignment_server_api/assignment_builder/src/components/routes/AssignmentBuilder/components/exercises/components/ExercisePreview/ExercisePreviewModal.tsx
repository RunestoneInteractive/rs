import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { useState } from "react";

import { Exercise } from "@/types/exercises";

import { ExercisePreview } from "./ExercisePreview";

export const ExercisePreviewModal = ({ htmlsrc }: Pick<Exercise, "htmlsrc">) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button
        outlined
        type="button"
        label="Preview"
        onClick={() => setShowModal(true)}
        size="small"
      />
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
    </>
  );
};
