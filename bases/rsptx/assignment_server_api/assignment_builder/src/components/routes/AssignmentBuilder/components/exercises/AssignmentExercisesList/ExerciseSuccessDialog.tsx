import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";

interface ExerciseSuccessDialogProps {
  showSuccessDialog: boolean;
  setShowSuccessDialog: (show: boolean) => void;
  handleCreateAnother: () => void;
  handleFinishCreating: () => void;
  lastExerciseType: string;
}

export const ExerciseSuccessDialog = ({
  showSuccessDialog,
  setShowSuccessDialog,
  handleCreateAnother,
  handleFinishCreating,
  lastExerciseType
}: ExerciseSuccessDialogProps) => {
  const successDialogFooter = (
    <div className="flex justify-content-between gap-2">
      <Button label="Create Another Exercise" icon="pi pi-plus" onClick={handleCreateAnother} />
      <Button label="Go to Exercise List" icon="pi pi-list" onClick={handleFinishCreating} />
    </div>
  );

  return (
    <Dialog
      visible={showSuccessDialog}
      onHide={() => setShowSuccessDialog(false)}
      header="Exercise Saved Successfully"
      footer={successDialogFooter}
      style={{ width: "450px" }}
      modal
      closable={false}
    >
      <div className="flex flex-column align-items-center text-center gap-3 py-3">
        <i
          className="pi pi-check-circle"
          style={{ fontSize: "3rem", color: "var(--green-500)" }}
        ></i>
        <p className="m-0 text-lg font-medium">
          Your {lastExerciseType} exercise has been successfully saved!
        </p>
        <p className="m-0">Would you like to create another exercise?</p>
      </div>
    </Dialog>
  );
};
