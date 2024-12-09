import { useToastContext } from "@components/ui/ToastContext";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { MenuItem } from "primereact/menuitem";
import { TabMenu } from "primereact/tabmenu";
import { Toast } from "primereact/toast";
import { JSX, useRef, useState } from "react";
import toast from "react-hot-toast";

import { ChooseExercises } from "./components/ChooseExercises/ChooseExercises";
import { CreateExercise } from "./components/CreateExercise/CreateExercise";
import { SearchExercises } from "./components/SearchExercises/SearchExercises";

type AddExerciseViewMode = "choose" | "search" | "create";

export const AssignmentViewComponent = ({
  mode,
  onExerciseAdd
}: {
  mode: AddExerciseViewMode;
  onExerciseAdd: VoidFunction;
}) => {
  const config: Record<AddExerciseViewMode, JSX.Element> = {
    choose: <ChooseExercises />,
    search: <SearchExercises />,
    create: <CreateExercise onExerciseAdd={onExerciseAdd} />
  };

  return config[mode];
};

export const AddExerciseModal = () => {
  const [showDialog, setShowDialog] = useState(false);
  const modes: MenuItem[] = [
    { label: "Choose exercises from the book", id: "choose" },
    { label: "Search exercises", id: "search" },
    { label: "Write an exercise", id: "create" }
  ];
  const [mode, setMode] = useState(0);
  const { showToast, clearToast } = useToastContext();

  const handleClose = () => setShowDialog(false);

  const handleOpen = () => {
    clearToast();
    setShowDialog(true);
  };

  const onExerciseAdd = () => {
    handleClose();
    showToast({
      severity: "info",
      sticky: true,
      content: () => (
        <div className="flex flex-column align-items-left" style={{ flex: "1" }}>
          <div className="flex align-items-center gap-2">
            <span className="text-900">Exercise has been created!</span>
          </div>
          <div className="font-medium my-3 text-900">Would you like to add a new one?</div>
          <Button
            className="p-button-sm flex"
            label="Add New Exercise"
            severity="info"
            onClick={() => {
              handleOpen();
              clearToast();
            }}
          ></Button>
        </div>
      )
    });
  };

  return (
    <div>
      <Button type="button" label="Add Exercise" onClick={handleOpen} size="small" />
      <Dialog
        header={<TabMenu model={modes} activeIndex={mode} onTabChange={(e) => setMode(e.index)} />}
        visible={showDialog}
        style={{ width: "90vw" }}
        headerStyle={{ padding: "1rem 2rem" }}
        modal
        maximizable
        onHide={handleClose}
      >
        <AssignmentViewComponent
          onExerciseAdd={onExerciseAdd}
          mode={modes[mode].id as AddExerciseViewMode}
        />
      </Dialog>
    </div>
  );
};
