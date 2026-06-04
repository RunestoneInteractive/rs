// The Assignment Picker is a dropdown menu that allows the user to select an assignment.
// It works in combination with the AssignmentEditor component by populating elements of the
// shared slice.
// The AssignmentPicker component uses the PrimeReact Dropdown component.
// The assignment picker also works with the AssignmentQuestion component to populate the table
// with the questions in the selected assignment.

import { Select } from "@mantine/core";
import { DateTime } from "luxon";
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

  const renderAssignmentOption = ({ option }) => {
    const current = sorted_assignments.find((a) => String(a.id) === option.value);

    return (
      <div>
        <span style={optionStyle}>{current.name}</span>
        <span style={optionStyle2}>
          {DateTime.fromISO(current.duedate).toLocaleString(DateTime.DATETIME_MED)}
        </span>
      </div>
    );
  };

  return (
    <div className="App card flex justify-content-center" style={menuStyle}>
      <Select
        value={selectedAssignment ? String(selectedAssignment.id) : null}
        className="w-full"
        data={sorted_assignments.map((a) => ({ value: String(a.id), label: a.name }))}
        placeholder="Choose Assignment"
        renderOption={renderAssignmentOption}
        searchable
        onChange={(value) => {
          const current = sorted_assignments.find((a) => String(a.id) === value);

          if (!current) {
            return;
          }
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
      ></Select>
    </div>
  );
}
