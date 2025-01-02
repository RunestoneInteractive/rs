import { MenuItem } from "primereact/menuitem";
import { TabMenu } from "primereact/tabmenu";
import { JSX, useState } from "react";

import { AssignmentFormProps } from "@/types/assignment";

import { AssignmentExercises } from "./exercises/AssignmentExercises";
import { AssignmentGeneral } from "./general/AssignmentGeneral";
import { AssignmentReadings } from "./reading/AssignmentReadings";

type AssignmentViewMode = "general" | "reading" | "exercise";

export const AssignmentViewComponent = ({
  mode,
  ...restProps
}: { mode: AssignmentViewMode } & AssignmentFormProps) => {
  const config: Record<AssignmentViewMode, JSX.Element> = {
    general: <AssignmentGeneral {...restProps} />,
    reading: <AssignmentReadings />,
    exercise: <AssignmentExercises />
  };

  return config[mode];
};

export const AssignmentViewSelect = (props: AssignmentFormProps) => {
  const modes: MenuItem[] = [
    { label: "General settings", id: "general" },
    { label: "Readings", id: "reading" },
    { label: "Exercises", id: "exercise" }
  ];
  const [mode, setMode] = useState(0);

  return (
    <>
      <div className="field col-12">
        <TabMenu model={modes} activeIndex={mode} onTabChange={(e) => setMode(e.index)} />
      </div>
      <AssignmentViewComponent {...props} mode={modes[mode].id as AssignmentViewMode} />
    </>
  );
};
