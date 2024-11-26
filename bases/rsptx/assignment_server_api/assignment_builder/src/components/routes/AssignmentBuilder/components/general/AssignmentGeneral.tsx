import { KindOfAssignmentOptions } from "@components/routes/AssignmentBuilder/components/general/KindOfAssignmentOptions";
import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { SelectButton } from "primereact/selectbutton";
import { useState } from "react";

import { KindOfAssignment } from "@/types/assignment";
type KindOfAssignmentOption = { label: string; value: KindOfAssignment };

export const AssignmentGeneral = () => {
  const [calendarValue, setCalendarValue] = useState<Date | null>(null);

  const options: Array<KindOfAssignmentOption> = [
    { label: "Regular", value: "Regular" },
    { label: "Quiz / Exam", value: "Timed" },
    { label: "Peer Instruction", value: "Peer" }
  ];
  const [selectedOption, setSelectedOption] = useState<KindOfAssignment>("Regular");

  return (
    <>
      <div className="field col-12">
        <label htmlFor="description">Assignment Description</label>
        <InputTextarea id="description" rows={2} autoResize maxLength={500} />
      </div>
      <div className="field col-12 md:col-6">
        <label htmlFor="duedate">Due</label>
        <Calendar
          id="duedate"
          selectionMode="single"
          showIcon
          showButtonBar
          value={calendarValue}
          onChange={(e) => setCalendarValue(e.value ?? null)}
        />
      </div>
      <div className="field col-12 md:col-6">
        <label htmlFor="points">Points</label>
        <InputNumber id="points" type="number" min={0} max={1000} />
      </div>
      <div className="field col-12">
        <label htmlFor="kindOfAssignment">What kind of Assignment?</label>
        <SelectButton
          id="kindOfAssignment"
          value={selectedOption}
          onChange={(e) => setSelectedOption(e.value)}
          options={options}
          optionLabel="label"
        />
      </div>
      <KindOfAssignmentOptions selectedOption={selectedOption} />
    </>
  );
};
