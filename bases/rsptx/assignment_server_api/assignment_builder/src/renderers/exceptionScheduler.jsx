import React from "react";

import { useSelector, useDispatch } from "react-redux";
import { Toaster } from 'react-hot-toast';
import { ListBox } from 'primereact/listbox';
import { selectAllAssignments } from "../state/assignment/assignSlice";
import { fetchClassRoster, selectRoster, selectSelectedStudents, saveException } from "../state/student/studentSlice";
import { setSelectedStudents as setStudents } from "../state/student/studentSlice";
import { setSelected, selectSelectedAssignments } from "../state/assignment/assignSlice";
import store from "../state/store";
import { InputNumber } from 'primereact/inputnumber';
import { InputSwitch } from "primereact/inputswitch";
import { Button } from 'primereact/button';

store.dispatch(fetchClassRoster());

export function ExceptionScheduler() {
    let students = useSelector(selectSelectedStudents);
    let assignments = useSelector(selectSelectedAssignments);
    const dispatch = useDispatch();
    const [checked, setChecked] = React.useState(false);
    const [tlMult, setTlMult] = React.useState(null);
    const [extraDays, setExtraDays] = React.useState(null);
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
                }
                dispatch(saveException(exception));
            }
            else {
                for (let assignment of assignments) {
                    console.log(`Saving exception: ${student.username} ${tlMult}, ${extraDays}, ${checked}`);
                    let exception = {
                        time_limit: tlMult,
                        due_date: extraDays,
                        visible: checked,
                        sid: student.username,
                        assignment_id: assignment.id
                    }
                    dispatch(saveException(exception));
                }
            }
        }
    }

    let style = {
        width: "100%",
        maxWidth: "100%",
        marginTop: "1rem",
        padding: "1rem",
        border: "1px solid #ccc",
        borderRadius: "5px",
        marginBottom: "1rem",
        backgroundColor: "white",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.26)",
    }
    return (
        <div className="App">
            <h1>Accommodation Scheduler</h1>
            <p>Create scheduling or access exceptions for assignments.</p>
            <p>October 26, This is an experimental feature.  Visible and time limit should work, but have only limited testing.  Added days have not been implemented yet.</p>
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
                        max={5.0} />
                </div>
                <div className="flex-auto">
                    <label htmlFor="extradays">Number of Extra Days</label>
                    <InputNumber
                        id="extradays"
                        placeholder="integer, extra days, time is the same"
                        value={extraDays}
                        onValueChange={(e) => setExtraDays(e.value)} />
                </div>
                <div className="flex-auto">
                    <label htmlFor="access">Allow student to see/access assignments that are not visible to others.</label>
                    <InputSwitch id="access" checked={checked} onChange={(e) => setChecked(e.value)} />
                    <p></p>
                </div>
            </div>
            <Button label="Save" onClick={saveAllExceptions} />
        </div>

    )

}


function StudentPicker() {
    const dispatch = useDispatch();
    let students = useSelector(selectRoster);
    const [selectedStudents, setSelectedStudents] = React.useState([]);

    const handleChange = (e) => {
        setSelectedStudents(e.value);
        dispatch(setStudents(e.value));
    }
    return (
        <ListBox multiple
            value={selectedStudents}
            options={students}
            optionLabel="username"
            itemTemplate={studentTemplate}
            onChange={handleChange}
            listStyle={{ maxHeight: '250px' }}
        />

    )
}

const studentTemplate = (option) => {
    return (
        <div className="flex align-items-center">
            <div>{option.username} ({option.first_name} {option.last_name})</div>
        </div>
    );
};
function AssignmentPicker() {
    const dispatch = useDispatch();
    let assignments = useSelector(selectAllAssignments);
    const [selectedAssignments, setSelectedAssignments] = React.useState([]);

    const handleChange = (e) => {
        setSelectedAssignments(e.value);
        dispatch(setSelected(e.value));
    }
    return (

        <ListBox multiple
            value={selectedAssignments}
            onChange={handleChange}
            options={assignments}
            optionLabel="name"
            listStyle={{ maxHeight: '250px' }}
        />

    )
}

