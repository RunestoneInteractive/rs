import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { SelectButton } from "primereact/selectbutton";
import { Controller } from "react-hook-form";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { AssignmentFormProps, KindOfAssignment } from "@/types/assignment";
import { convertDateToISO, convertISOStringToDate } from "@/utils/date";

import { KindOfAssignmentOptions } from "./KindOfAssignmentOptions";
type KindOfAssignmentOption = { label: string; value: KindOfAssignment };

export const AssignmentGeneral = ({ control, setValue, getValues }: AssignmentFormProps) => {
  const { selectedAssignment } = useSelectedAssignment();

  if (!selectedAssignment) {
    return null;
  }

  const options: Array<KindOfAssignmentOption> = [
    { label: "Regular", value: "Regular" },
    { label: "Quiz / Exam", value: "Timed" },
    { label: "Peer Instruction", value: "Peer" }
  ];

  return (
    <form style={{ display: "contents" }}>
      <div className="field col-12">
        <label htmlFor="description">Assignment Description</label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <InputTextarea id="description" {...field} rows={2} autoResize maxLength={500} />
          )}
        />
      </div>
      <div className="field col-12 md:col-6">
        <span className="inline-block mb-2">Due</span>
        <Controller
          name="duedate"
          control={control}
          render={({ field }) => (
            <Calendar
              dateFormat="dd/mm/yy"
              showTime
              hourFormat="12"
              id="duedate"
              {...field}
              selectionMode="single"
              hideOnDateTimeSelect
              stepMinute={5}
              showIcon
              value={convertISOStringToDate(field.value)}
              onChange={(e) => setValue("duedate", convertDateToISO(e.value!))}
            />
          )}
        />
      </div>
      <div className="field col-12 md:col-6">
        <span className="inline-block mb-2">Points</span>
        <Controller
          name="points"
          control={control}
          render={({ field }) => (
            <InputNumber {...field} id="points" min={0} disabled value={field.value ?? 0} />
          )}
        />
      </div>
      <div className="field col-12">
        <span className="inline-block mb-2">What kind of Assignment?</span>
        <Controller
          name="kind"
          control={control}
          render={({ field }) => (
            <SelectButton {...field} id="kind" options={options} optionLabel="label" />
          )}
        />
      </div>
      <KindOfAssignmentOptions control={control} setValue={setValue} getValues={getValues} />
    </form>
  );
};
