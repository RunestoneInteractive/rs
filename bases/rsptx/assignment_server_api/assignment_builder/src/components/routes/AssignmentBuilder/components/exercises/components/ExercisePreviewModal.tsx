import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { useState } from "react";

import { Exercise } from "@/types/exercises";

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
        style={{ width: "45vw" }}
        modal
        contentStyle={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0
        }}
        onHide={() => setShowModal(false)}
        headerStyle={{ padding: "0.5rem" }}
      >
        <ExercisePreview htmlsrc={htmlsrc} />
      </Dialog>
    </>
  );
};
