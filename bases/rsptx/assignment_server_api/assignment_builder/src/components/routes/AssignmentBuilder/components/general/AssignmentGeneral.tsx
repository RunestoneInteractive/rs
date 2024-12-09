import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { SelectButton } from "primereact/selectbutton";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { KindOfAssignment } from "@/types/assignment";
import { convertDateToISO, convertISOStringToDate } from "@/utils/date";

import { KindOfAssignmentOptions } from "./KindOfAssignmentOptions";
type KindOfAssignmentOption = { label: string; value: KindOfAssignment };

export const AssignmentGeneral = () => {
  const { selectedAssignment, updateAssignment } = useSelectedAssignment();

  if (!selectedAssignment) {
    return null;
  }

  const options: Array<KindOfAssignmentOption> = [
    { label: "Regular", value: "Regular" },
    { label: "Quiz / Exam", value: "Timed" },
    { label: "Peer Instruction", value: "Peer" }
  ];

  return (
    <>
      <div className="field col-12">
        <label htmlFor="description">Assignment Description</label>
        <InputTextarea
          id="description"
          rows={2}
          autoResize
          maxLength={500}
          value={selectedAssignment.description}
          onChange={(e) => updateAssignment({ description: e.target.value })}
        />
      </div>
      <div className="field col-12 md:col-6">
        <label htmlFor="duedate">Due</label>
        <Calendar
          dateFormat="dd/mm/yy"
          showTime
          hourFormat="12"
          id="duedate"
          selectionMode="single"
          hideOnDateTimeSelect
          stepMinute={5}
          showIcon
          value={convertISOStringToDate(selectedAssignment.duedate)}
          onChange={(e) => e.value && updateAssignment({ duedate: convertDateToISO(e.value) })}
        />
      </div>
      <div className="field col-12 md:col-6">
        <label htmlFor="points">Points</label>
        <InputNumber
          id="points"
          min={0}
          value={selectedAssignment.points ?? 0}
          onChange={(e) => updateAssignment({ points: e.value ?? 0 })}
        />
      </div>
      <div className="field col-12">
        <label htmlFor="kindOfAssignment">What kind of Assignment?</label>
        <SelectButton
          id="kindOfAssignment"
          value={selectedAssignment.kind}
          onChange={(e) => {
            updateAssignment({ kind: e.value });
          }}
          options={options}
          optionLabel="label"
        />
      </div>
      <KindOfAssignmentOptions />
    </>
  );
};
