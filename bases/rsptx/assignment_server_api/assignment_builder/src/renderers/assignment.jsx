import { useSelector, useDispatch } from "react-redux";
import { useState, useEffect } from "react";

import { DateTime } from "luxon";
import 'handsontable/dist/handsontable.full.min.css';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';

//import "primereact/resources/themes/bootstrap4-light-blue/theme.css"
import "primereact/resources/themes/lara-light-cyan/theme.css";
import { Dropdown } from 'primereact/dropdown';
import { Panel } from 'primereact/panel';
import { TabView, TabPanel } from 'primereact/tabview';
import { InputText } from 'primereact/inputtext';
import { Calendar } from 'primereact/calendar';
import { InputNumber } from 'primereact/inputnumber';
import { InputSwitch } from 'primereact/inputswitch';

import { SelectButton } from 'primereact/selectbutton';
import { PrimeIcons } from 'primereact/api';
import { TreeTable } from 'primereact/treetable';
import { Column } from 'primereact/column';
import { NodeService } from '../service/NodeService';

// This registers all the plugins for the Handsontable library
registerAllModules();


import {
    updateField,
    selectName,
    selectDesc,
    selectDue,
    selectPoints,
    selectExercises,
    selectAll,
    setName,
    setDesc,
    setDue,
    setPoints,
    fetchAssignmentQuestions,
    updateExercise,
    sendExercise,
    reorderExercise,
    deleteExercises,
    sendDeleteExercises,
    reorderAssignmentQuestions
} from "../state/assignment/assignSlice";
import ActiveCodeCreator from "./activeCode";
import { Button } from "primereact/button";


// The AssignmentEditor component is a form that allows the user to create or edit an assignment.
// The form has fields for the name, description, due date, and total points.
function AssignmentEditor() {
    const dispatch = useDispatch();
    const name = useSelector(selectName);
    const desc = useSelector(selectDesc);
    const due = useSelector(selectDue);
    const points = useSelector(selectPoints);
    const exercises = useSelector(selectExercises);
    const assignData = useSelector(selectAll);

    // The setAsgmtData function is used to update the state of the assignData object.
    // The notice that the parameter to setAsgmtData is a function that takes the previous
    // state and returns the new state.
    const handleAsgmtDataChange = (e) => {
        dispatch(updateField({ field: e.target.id, newVal: e.target.value }));
    };

    return (
        <div className="App">
            <div className="p-fluid">
                <div className="p-field p-grid">
                    <label htmlFor="name" className="p-col-12 p-md-2">Assignment Name</label>
                    <InputText
                        id="name"
                        placeholder="Enter Assignment Name"
                        value={name}
                        onChange={(e) => dispatch(setName(e.target.value))} />

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
                                onChange={(e) => dispatch(setDue(e.target.value))}
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

// The Assignment Picker is a dropdown menu that allows the user to select an assignment.
// It works in combination with the AssignmentEditor component by populating elements of the
// shared slice.
// The AssignmentPicker component uses the PrimeReact Dropdown component.
// The assignment picker also works with the AssignmentQuestion component to populate the table
// with the questions in the selected assignment.
export function AssignmentPicker() {
    const dispatch = useDispatch();
    const assignData = useSelector(selectAll);
    const [selectedAssignment, setAssignment] = useState(null);
    const handleAssignmentChange = (e) => {
        dispatch(setAssignment(e.target.value));
    };

    const sortFunc = (a, b) => {
        return a.duedate.localeCompare(b.duedate);
    };

    const all_assignments = useSelector(selectAll).all_assignments;
    let sorted_assignments = structuredClone(all_assignments)
        .sort(sortFunc)
        .reverse();
    sorted_assignments = sorted_assignments.filter((a) => a.name !== "");

    const menuStyle = {
        width: "25rem",
        marginBottom: "10px"
    };


    const optionStyle = {
        width: "12rem",
        marginRight: "10px",
        textAlign: "left",
        float: "left"
    };

    const optionStyle2 = {
        width: "12rem",
        textAlign: "end"
    }

    const optionTemplate = (option) => {
        return (
            <div>
                <span style={optionStyle}>{option.name}</span>
                <span style={optionStyle2}>
                    {DateTime.fromISO(option.duedate).toLocaleString(
                        DateTime.DATETIME_MED
                    )}
                </span>
            </div>
        );
    }
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
                    dispatch(fetchAssignmentQuestions(current.id));
                    setAssignment(current);
                }}
            >

            </Dropdown>
        </div>
    )
}

//
// The AssignmentQuestion component is a table that displays the questions in the assignment.
// The table is editable and the user can change the points, autograde, and which_to_grade fields.
// Questions can be reordered and deleted.
// This table uses the Handsontable library.
// It may make sense to revisit this and have it use PrimeReact components.  But for now, it works.
export function AssignmentQuestion() {
    const dispatch = useDispatch();
    const columns = ["id", "qnumber", "points", "autograde", "which_to_grade"];
    const question_rows = useSelector(selectExercises);
    const hotData = question_rows.map(({ id, qnumber, points, autograde, which_to_grade }) =>
        (Object.values({ id, qnumber, points, autograde, which_to_grade })));

    const posToKey = new Map([[0, "id"], [1, "question_id"], [2, "points"], [3, "autograde"], [4, "which_to_grade"]]);

    const handleChange = (change, source) => {
        if (source === "loadData" || source === "updateData") {
            return;
        }
        console.log(change); // gives us [row, column, oldVal, newVal]
        console.log(hotData);
        console.log(posToKey);
        console.log(posToKey.get(change[0][1]));
        for (let c of change) {
            let row = c[0];
            let col = c[1];
            let oldVal = c[2];
            let newVal = c[3];
            let id = hotData[row][0];
            let key = posToKey.get(col);
            let new_row = structuredClone(question_rows[row])
            new_row[key] = newVal;
            if (newVal !== oldVal) {
                dispatch(updateExercise({ id: id, exercise: new_row }))
                dispatch(sendExercise(new_row))
            }
        }
    };

    const handleDelete = (start, amount) => {
        // by the time this is called hotData is already updated
        console.log("delete row", start, amount);
        let toRemove = question_rows.slice(start, start + amount).map((ex) => ex.id);
        try {
            dispatch(deleteExercises(toRemove));
            dispatch(sendDeleteExercises(toRemove))
        } catch (e) {
            console.error(e);
        }
    };

    const handleReorder = (rows, target) => {
        console.log("reorder", rows, target);
        // copy hotData to avoid mutating the state
        let idxs = hotData.map((r) => r[0]);
        let toMove = idxs.splice(rows[0], rows.length);
        if (target > rows[0]) {
            target -= rows.length;
        }
        idxs.splice(target, 0, ...toMove);
        dispatch(reorderExercise({ exOrder: idxs }));
        dispatch(reorderAssignmentQuestions(idxs));
    };
    const aqStyle = {
        marginBottom: "10px",
    }

    return (
        <div className="App">
            <Panel header="Assignment Questions" toggleable>
                <HotTable
                    style={aqStyle}
                    width="100%"
                    data={hotData}
                    stretchH="all"
                    colHeaders={columns}
                    rowHeaders={true}
                    manualRowMove={true}
                    contextMenu={true}
                    allowRemoveRow={true}
                    columns={[{ type: "numeric", readOnly: true },
                    { type: "numeric", readOnly: true },
                    { type: "numeric" },
                    {
                        type: "dropdown",
                        source: ["manual", "all_or_nothing", "pct_correct", "peer", "peer_chat", "interaction", "unittest"]
                    },
                    {
                        type: "dropdown",
                        source: ["first_answer", "last_answer", "all_answer", "best_answer"]
                    }
                    ]}
                    afterChange={handleChange}
                    afterRowMove={handleReorder}
                    afterRemoveRow={handleDelete}
                    licenseKey="non-commercial-and-evaluation"
                />
            </Panel>
        </div>
    );
}

export function MoreOptions() {
    const options = ['Regular', 'Timed', "Peer"];
    const [assignmentKind, setAssignmentKind] = useState(options[0]);
    const assignData = useSelector(selectAll);

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
            <Panel header="More Options" collapsed={true} toggleable>
                <div className="p-fluid">
                    <div className="p-field p-grid">
                        <label htmlFor="name" className="p-col-12 p-md-2">What kind of Assignment?</label>
                        <SelectButton value={assignmentKind} onChange={(e) => setAssignmentKind(e.value)} options={options} />
                    </div>
                    {renderOptions()}
                </div>
            </Panel>
        </div>
    );
}



export function AddQuestionTabGroup() {
    const [activeIndex, setActiveIndex] = useState(0);
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
                    <ExerciseSelector />
                </TabPanel>
            </TabView>
        </div>
    );
}

export function SearchPanel() {
    // Just stub this out now as a prototype...
    return (
        <div className="p-fluid">
            <label htmlFor="basecourse">Constrain to base course</label>
            <InputSwitch id="basecourse" checked={true} />
            <br />
            <label htmlFor="search">Free Text Search for Question</label>
            <InputText id="search"
                placeholder="question text"
            />
            <label htmlFor="tags">Search by Tags</label>
            <InputText id="tags"
                placeholder="tags"
            />
            <label htmlFor="difficulty">Search by Difficulty</label>
            <InputText id="difficulty"
                placeholder="difficulty"
            />
            <label htmlFor="type">Search by Question Type</label>
            <InputText id="type"
                placeholder="type"
            />
            <label htmlFor="author">Search by Author</label>
            <InputText id="author"
                placeholder="author"
            />
            <Button label="Search" icon="pi pi-search" />
            <h3>Search Results</h3>
            <ExerciseSelector />
        </div>
    );
}


// export class NodeService {

//     getTreeTableNodes() {
//         return fetch('data/treetablenodes.json').then(res => res.json())
//                 .then(d => d.root);
//     }

//     getTreeNodes() {
//         return fetch('data/treenodes.json').then(res => res.json())
//                 .then(d => d.root);
//     }
// }

export function ExerciseSelector() {
    const [nodes, setNodes] = useState([]);
    const [selectedNodeKeys, setSelectedNodeKeys] = useState(null);

    useEffect(() => {
        NodeService.getTreeTableNodes().then((data) => setNodes(data));
    }, []);

    return (
        <div className="card">
            <TreeTable value={nodes} selectionMode="checkbox" selectionKeys={selectedNodeKeys} onSelectionChange={(e) => setSelectedNodeKeys(e.value)} tableStyle={{ minWidth: '10rem' }}>
                <Column field="name" header="Name" expander></Column>
                <Column field="question_type" header="QuestionType"></Column>
                <Column field="autograde" header="Auto Graded"></Column>
            </TreeTable>
        </div>
    )
}

export default AssignmentEditor;
