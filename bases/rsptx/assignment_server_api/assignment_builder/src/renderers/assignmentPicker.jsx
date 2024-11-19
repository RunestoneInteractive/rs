// The Assignment Picker is a dropdown menu that allows the user to select an assignment.
// It works in combination with the AssignmentEditor component by populating elements of the
// shared slice.
// The AssignmentPicker component uses the PrimeReact Dropdown component.
// The assignment picker also works with the AssignmentQuestion component to populate the table
// with the questions in the selected assignment.

import { DateTime } from "luxon";
import { Dropdown } from "primereact/dropdown";
import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  selectAll,
  setId,
  setName,
  setDesc,
  setDue,
  setPoints,
  setFromSource,
  setReleased,
  fetchAssignmentQuestions,
} from "../state/assignment/assignSlice";

/**
 * @description The AssignmentPicker component is a dropdown menu that allows the user to select an assignment.
 * This may be useful but the AssignmentEditor contains a nicer autocomplete feature for choosing assignments.
 * @returns The AssignmentPicker component
 * @memberof AssignmentEditor
 */
export function AssignmentPicker() {
  const dispatch = useDispatch();
  const [selectedAssignment, setAssignment] = useState(null);
  // todo: need to set the selected nodes here after setAssignment

  const sortFunc = (a, b) => {
    return a.duedate.localeCompare(b.duedate);
  };

  const all_assignments = useSelector(selectAll).all_assignments;
  let sorted_assignments = structuredClone(all_assignments).sort(sortFunc).reverse();

  sorted_assignments = sorted_assignments.filter((a) => a.name !== "");

  const menuStyle = {
    width: "25rem",
    marginBottom: "10px",
  };

  const optionStyle = {
    width: "12rem",
    marginRight: "10px",
    textAlign: "left",
    float: "left",
  };

  const optionStyle2 = {
    width: "12rem",
    textAlign: "end",
  };

  const optionTemplate = (option) => {
    return (
      <div>
        <span style={optionStyle}>{option.name}</span>
        <span style={optionStyle2}>
          {DateTime.fromISO(option.duedate).toLocaleString(DateTime.DATETIME_MED)}
        </span>
      </div>
    );
  };

  return (
    <div className="App card flex justify-content-center" style={menuStyle}>
      <Dropdown
        value={selectedAssignment}
        className="w-full md:w-14rem p-button-secondary"
        options={sorted_assignments}
        optionLabel="name"
        placeholder="Choose Assignment"
        itemTemplate={optionTemplate}
        filter
        onChange={(e) => {
          let current = e.value;

          dispatch(setName(current.name));
          dispatch(setDesc(current.description));
          dispatch(setDue(current.duedate));
          dispatch(setPoints(current.points));
          dispatch(setId(current.id));
          dispatch(setDue(current.duedate));
          dispatch(setFromSource(current.from_source));
          dispatch(setReleased(current.released));
          dispatch(fetchAssignmentQuestions(current.id));
          setAssignment(current);
        }}
      ></Dropdown>
    </div>
  );
}
