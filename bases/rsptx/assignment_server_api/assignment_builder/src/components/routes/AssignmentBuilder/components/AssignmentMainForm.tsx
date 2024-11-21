import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { useEffect, useMemo, useState } from "react";

export const AssignmentMainForm = () => {
  const [calendarValue, setCalendarValue] = useState<Date | null>(null);

  return (
    <>
      <div className="field col-12">
        <label htmlFor="description">Assignment Description</label>
        <InputTextarea id="description" rows={2} />
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
        <InputText id="points" type="text" />
      </div>
      <div className="field col-12">
        <label htmlFor="address">Address</label>
        <InputTextarea id="address" rows={2} />
      </div>
      {/*<div className="field col-12 md:col-6">*/}
      {/*  <label htmlFor="city">City</label>*/}
      {/*  <InputText id="city" type="text" />*/}
      {/*</div>*/}
      {/*<div className="field col-12 md:col-3">*/}
      {/*  <label htmlFor="state">State</label>*/}
      {/*  <Dropdown*/}
      {/*    id="state"*/}
      {/*    value={dropdownItem}*/}
      {/*    onChange={(e) => setDropdownItem(e.value)}*/}
      {/*    options={dropdownItems}*/}
      {/*    optionLabel="name"*/}
      {/*    placeholder="Select One"*/}
      {/*  ></Dropdown>*/}
      {/*</div>*/}
      {/*<div className="field col-12 md:col-3">*/}
      {/*  <label htmlFor="zip">Zip</label>*/}
      {/*  <InputText id="zip" type="text" />*/}
      {/*</div>*/}
    </>
  );
};
