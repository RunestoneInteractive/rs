import React from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { ListBox } from "primereact/listbox";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { useSelector, useDispatch } from "react-redux";

import { selectAllAssignments } from "../state/assignment/assignSlice";
import { setSelected, selectSelectedAssignments } from "../state/assignment/assignSlice";
import {
  fetchClassRoster,
  selectRoster,
  selectSelectedStudents,
  saveException
} from "../state/student/studentSlice";
import { setSelectedStudents as setStudents } from "../state/student/studentSlice";

export function ExceptionScheduler() {
  let students = useSelector(selectSelectedStudents);
  let assignments = useSelector(selectSelectedAssignments);
  const dispatch = useDispatch();

  dispatch(fetchClassRoster());
  const [checked, setChecked] = useState(false);
  const [tlMult, setTlMult] = useState(null);
  const [extraDays, setExtraDays] = useState(null);
  const [helpVisible, setHelpVisible] = useState(false);
  const saveAllExceptions = () => {
    for (let student of students) {
      if (assignments.length === 0) {
        console.log(`Saving exception: ${student.username} ${tlMult}, ${extraDays}, ${checked}`);
        let exception = {
          time_limit: tlMult,
          due_date: extraDays,
          visible: checked,
          sid: student.username,
          assignment_id: null
        };

        dispatch(saveException(exception));
      } else {
        for (let assignment of assignments) {
          console.log(`Saving exception: ${student.username} ${tlMult}, ${extraDays}, ${checked}`);
          let exception = {
            time_limit: tlMult,
            due_date: extraDays,
            visible: checked,
            sid: student.username,
            assignment_id: assignment.id
          };

          dispatch(saveException(exception));
        }
      }
    }
  };

  let style = {
    width: "100%",
    maxWidth: "100%",
    marginTop: "1rem",
    padding: "1rem",
    border: "1px solid #ccc",
    borderRadius: "5px",
    marginBottom: "1rem",
    backgroundColor: "white",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.26)"
  };

  return (
    <div className="App">
      <h1>Accommodation Scheduler</h1>
      <p>Create individualized deadlines or time limits for assignments.</p>
      <p>
        November 5, This is an experimental feature. All features should work, but please report any
        problems.{" "}
      </p>
      <Toaster />
      <h3>Choose one or more students</h3>
      <StudentPicker />
      <h3>Choose zero or more assignments</h3>
      <p>If you do not select an assignment then the exception applies to all assignments.</p>
      <AssignmentPicker />
      <div className="card flex flex-wrap gap-3 p-fluid" style={style}>
        <div className="flex-auto">
          <label htmlFor="tlmulti">Time Limit Multiplier</label>
          <InputNumber
            id="tlmulti"
            placeholder="1.5, 2.0 or similar"
            value={tlMult}
            onValueChange={(e) => setTlMult(e.value)}
            minFractionDigits={1}
            maxFractionDigits={2}
            min={1.0}
            max={5.0}
          />
        </div>
        <div className="flex-auto">
          <label htmlFor="extradays">Number of Extra Days</label>
          <InputNumber
            id="extradays"
            placeholder="integer, extra days, time is the same"
            value={extraDays}
            onValueChange={(e) => setExtraDays(e.value)}
          />
        </div>
        <div className="flex-auto">
          <label htmlFor="access">
            Allow student to see/access assignments that are not visible to others.
          </label>
          <InputSwitch id="access" checked={checked} onChange={(e) => setChecked(e.value)} />
        </div>
        <div className="flex-auto">
          <Button
            icon="pi pi-question-circle"
            rounded
            outlined
            onClick={() => setHelpVisible(true)}
          />
          <Dialog
            header="Help"
            visible={helpVisible}
            style={{ width: "50vw" }}
            onHide={() => setHelpVisible(false)}
          >
            <p>
              <ul>
                <li>Time Limit Multiplier: Give the student N times the standard amount</li>
                <li>Extra Days: Extend the deadline by X days.</li>
                <li>
                  Access: Allow the student to see and access the assignment even if it is not
                  visible to others.
                </li>
              </ul>
              Note: If you have already extended the deadline for a student by N days and you still
              want to give them more time, you should enter the total number of days you want to
              give them. The last entry wins.
            </p>
          </Dialog>
          <p></p>
        </div>
      </div>
      <Button label="Save" onClick={saveAllExceptions} />
    </div>
  );
}

function StudentPicker() {
  const dispatch = useDispatch();
  let students = useSelector(selectRoster);
  const [selectedStudents, setSelectedStudents] = useState([]);

  const handleChange = (e) => {
    setSelectedStudents(e.value);
    dispatch(setStudents(e.value));
  };

  return (
    <ListBox
      multiple
      filter
      value={selectedStudents}
      options={students}
      optionLabel="label"
      //itemTemplate={studentTemplate}
      onChange={handleChange}
      listStyle={{ maxHeight: "250px" }}
    />
  );
}

const studentTemplate = (option) => {
  return (
    <div className="flex align-items-center">
      <div>
        {option.username} ({option.first_name} {option.last_name})
      </div>
    </div>
  );
};

function AssignmentPicker() {
  const dispatch = useDispatch();
  let assignments = useSelector(selectAllAssignments);
  const [selectedAssignments, setSelectedAssignments] = useState([]);

  const handleChange = (e) => {
    setSelectedAssignments(e.value);
    dispatch(setSelected(e.value));
  };

  return (
    <ListBox
      multiple
      filter
      value={selectedAssignments}
      onChange={handleChange}
      options={assignments}
      optionLabel="name"
      listStyle={{ maxHeight: "250px" }}
    />
  );
}
