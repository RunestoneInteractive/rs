import { AssignmentExercises } from "@components/routes/AssignmentBuilder/components/exercises/AssignmentExercises";
import { AssignmentGeneral } from "@components/routes/AssignmentBuilder/components/general/AssignmentGeneral";
import { AssignmentReadings } from "@components/routes/AssignmentBuilder/components/reading/AssignmentReadings";
import { MenuItem } from "primereact/menuitem";
import { TabMenu } from "primereact/tabmenu";
import { JSX, useState } from "react";

type AssignmentViewMode = "general" | "reading" | "exercise";

export const AssignmentViewComponent = ({ mode }: { mode: AssignmentViewMode }) => {
  const config: Record<AssignmentViewMode, JSX.Element> = {
    general: <AssignmentGeneral />,
    reading: <AssignmentReadings />,
    exercise: <AssignmentExercises />
  };

  return config[mode];
};

export const AssignmentViewSelect = () => {
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
      <AssignmentViewComponent mode={modes[mode].id as AssignmentViewMode} />
    </>
  );
};
