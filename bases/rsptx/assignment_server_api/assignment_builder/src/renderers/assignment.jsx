import { useSelector, useDispatch } from "react-redux";
import React, { useState, useEffect } from "react";


//import "primereact/resources/themes/bootstrap4-light-blue/theme.css"
import "primereact/resources/themes/lara-light-cyan/theme.css";
import { Panel } from 'primereact/panel';
import { TabView, TabPanel } from 'primereact/tabview';
import { InputText } from 'primereact/inputtext';
import { AutoComplete } from "primereact/autocomplete";
import { Calendar } from 'primereact/calendar';
import { InputNumber } from 'primereact/inputnumber';
import { InputSwitch } from 'primereact/inputswitch';
import { SelectButton } from 'primereact/selectbutton';
import { ExerciseSelector } from './ePicker';
import { SearchPanel } from "./searchPanel";
import store from "../state/store";


import {
    updateField,
    selectName,
    selectDesc,
    selectDue,
    selectPoints,
    selectAll,
    setId,
    setName,
    setDesc,
    setDue,
    setPoints,
    setFromSource,
    setReleased,
    setVisible,
    setIsPeer,
    setIsTimed,
    setTimeLimit,
    setNoFeedback,
    setNoPause,
    setPeerAsyncVisible,
    fetchAssignmentQuestions,
    createAssignment,
    sendAssignmentUpdate,
} from "../state/assignment/assignSlice";
import ActiveCodeCreator from "./activeCode";
import { Button } from "primereact/button";

function select(state) {
    return state.assignment
}

function diff(oldobj, newobj) {
    if (!oldobj || !newobj) {
        return {};
    }
    const diff = Object.entries({ ...oldobj, ...newobj }).filter(([key]) => oldobj[key] !== newobj[key]);
    return Object.fromEntries(diff);
}
let currentValue
function handleChange() {
    let previousValue = currentValue
    currentValue = select(store.getState())

    if (currentValue && previousValue !== currentValue) {
        if (currentValue.id !== 0) {
            let changes = diff(previousValue, currentValue)
            let keys = Object.keys(changes)
            let updateKeys = ["due", "points", "visible", "time_limit", "peer_async_visible", "is_peer", "is_timed", "nopause", "nofeedback"]
            let update = keys.filter((k) => updateKeys.includes(k))
            if (update.length > 0) {
                console.log(`updating assignment ${update}`)
                let toSend = structuredClone(currentValue)
                delete toSend.all_assignments
                delete toSend.exercises
                store.dispatch(sendAssignmentUpdate(toSend))
                console.log("changes", update)
            }
        }
    }
}

const unsubscribe = store.subscribe(handleChange)


// The AssignmentEditor component is a form that allows the user to create or edit an assignment.
// The form has fields for the name, description, due date, and total points.
function AssignmentEditor() {
    const dispatch = useDispatch();
    const name = useSelector(selectName);
    const desc = useSelector(selectDesc);
    const due = useSelector(selectDue);
    const points = useSelector(selectPoints);
    const assignData = useSelector(selectAll);
    const [items, setItems] = useState(assignData.all_assignments.map((a) => a.name))
    const search = (e) => {
        setItems(assignData.all_assignments.filter((a) => a.name.toLowerCase().includes(e.query.toLowerCase())))
    }

    const chooseOrNameAssignment = (e) => {
        console.log(`in choseOrName ${e.value} items: ${items}`)
        // This is a bit tricky.
        // if e.value is an object then we are selecting an existing assignment
        // if e.value is a string then we are still searching
        // occasionally we get a hiccup where items isn't yet updated so will only create when
        // the button is clicked.
        if (typeof e.value === "string") {
            dispatch(setName(e.value))
        } else {
            console.log(`choosing current assignment ${e.value.name}`)
            let current = e.value;
            dispatch(setName(current.name));

            if (current.description === null) {
                dispatch(setDesc(""));
            } else {
                dispatch(setDesc(current.description));
            }
            dispatch(setDue(current.duedate));
            dispatch(setPoints(current.points));
            dispatch(setId(current.id));
            dispatch(setFromSource(current.from_source));
            dispatch(setReleased(current.released));
            dispatch(fetchAssignmentQuestions(current.id));
        }
    }

    const newAssignment = () => {
        // called when the create button is clicked.
        let assignment = {
            name: name,
            description: desc,
            duedate: due,
            points: points,
        }
        dispatch(createAssignment(assignment))
        // reset items so create button disappears
        setItems(assignData.all_assignments.map((a) => a.name))
    }

    // 
    const handleDueChange = (e) => {
        if (typeof (e.target.value) === "string") {
            dispatch(setDue(e.target.value));
        } else {
            dispatch(setDue(e.target.value.toISOString().replace("Z", "")));

        }
    }
    return (
        <div className="App">
            <div className="p-fluid">
                <div className="p-field p-grid">
                    <label htmlFor="name" className="p-col-12 p-md-2">Assignment Name</label>
                    <AutoComplete
                        id="name"
                        field="name"
                        suggestions={items}
                        completeMethod={search}
                        placeholder="Enter Assignment Name"
                        value={name}
                        onChange={chooseOrNameAssignment}
                        dropdown />
                    {items.length == 0 && name ? <Button onClick={newAssignment}>Create New</Button> : null}
                    <label htmlFor="desc" className="p-col-12 p-md-2">
                        Assignment Description
                    </label>
                    <InputText
                        id="desc"
                        placeholder="Enter Assignment Description"
                        value={desc}
                        onChange={(e) => dispatch(setDesc(e.target.value))}
                    />
                    <div className="contain2col">
                        <div className="item">
                            <label htmlFor="due" className="p-col-3">
                                Due
                            </label>
                            <Calendar
                                className="p-col-3"
                                id="due"
                                value={due}
                                placeholder={due}
                                onChange={handleDueChange}
                                showTime
                                hourFormat="12"
                            />
                        </div>

                        <div className="item">
                            <label htmlFor="points">
                                Total Points
                            </label>
                            <InputNumber
                                id="points"
                                placeholder="Points"
                                value={points}
                                onChange={(e) => dispatch(setPoints(e.value))}
                            />
                            <InputSwitch id="visible" checked={assignData.visible} onChange={(e) => dispatch(updateField({ field: "visible", newVal: e.value }))} />
                            <label htmlFor="visible">Visible to Students</label>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}


export function MoreOptions() {
    const options = ['Regular', 'Timed', "Peer"];
    const assignData = useSelector(selectAll);
    var kind = ""
    if (assignData.is_peer) {
        kind = "Peer"
    } else if (assignData.is_timed) {
        kind = "Timed"
    } else {
        kind = "Regular"
    }
    const [assignmentKind, setAssignmentKind] = useState(kind);

    const changeAssigmentKind = (e) => {
        setAssignmentKind(e.value);
        if (e.value === "Timed") {
            dispatch(updateField({ field: "is_timed", newVal: true }));
            dispatch(updateField({ field: "is_peer", newVal: false }));
        } else if (e.value === "Peer") {
            dispatch(updateField({ field: "is_timed", newVal: false }));
            dispatch(updateField({ field: "is_peer", newVal: true }));
        } else {
            dispatch(updateField({ field: "is_timed", newVal: false }));
            dispatch(updateField({ field: "is_peer", newVal: false }));
        }
    }
    const dispatch = useDispatch();
    const renderOptions = () => {
        if (assignmentKind === "Timed") {
            return (
                <>
                    <div className="p-inputgroup">
                        <span className="p-inputgroup-addon">
                            <i className="pi pi-clock">time</i>
                        </span>
                        <InputNumber id="timeLimit" placeholder="Time Limit (minutes)" value={assignData.timeLimit} onChange={(e) => dispatch(updateField({ field: "timeLimit", newVal: e.value }))} />
                        <span className="p-inputgroup-addon">
                            minutes
                        </span>
                    </div>
                    <label htmlFor="feedback">Allow Feedback</label>
                    <InputSwitch id="feedback" checked={assignData.feedback} onChange={(e) => dispatch(updateField({ field: "feedback", newVal: e.value }))} />
                    <label htmlFor="allowPause">Allow Pause</label>
                    <InputSwitch id="allowPause" checked={assignData.allowPause} onChange={(e) => dispatch(updateField({ field: "allowPause", newVal: e.value }))} />
                </>
            )
        } else if (assignmentKind === "Peer") {
            return (
                <>
                    <label htmlFor="showAsync">Show Async Peer</label>
                    <InputSwitch id="showAsync" checked={assignData.showAsync} onChange={(e) => dispatch(updateField({ field: "showAsync", newVal: e.value }))} />
                </>
            )
        } else {
            return (
                <p>No additional options</p>
            )
        }
    }

    return (
        <div className="App">
            <Panel header="More Options" collapsed={true} toggleable >
                <div className="p-fluid">
                    <div className="p-field p-grid">
                        <label htmlFor="name" className="p-col-12 p-md-2">What kind of Assignment?</label>
                        <SelectButton value={assignmentKind} onChange={changeAssigmentKind} options={options} />
                    </div>
                    {renderOptions()}
                </div>
            </Panel>
        </div>
    );
}



export function AddQuestionTabGroup() {
    const [activeIndex, setActiveIndex] = useState(2);
    return (
        <div className="App">
            <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
                <TabPanel header="Search for Exercises">
                    <SearchPanel />
                </TabPanel>
                <TabPanel header="Write an Exercise">
                    <ActiveCodeCreator />
                </TabPanel>
                <TabPanel header="Choose Exercises">
                    <ExerciseSelector />
                </TabPanel>
                <TabPanel header="Choose Readings">
                    <ExerciseSelector level="subchapter" />
                </TabPanel>
            </TabView>
        </div>
    );
}


export default AssignmentEditor;