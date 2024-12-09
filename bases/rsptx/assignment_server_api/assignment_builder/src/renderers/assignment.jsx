/**
 *
 * @fileoverview This file contains the AssignmentEditor component which is a form that allows the user to create or edit an assignment.
 *
 */

import { useSelector, useDispatch } from "react-redux";
import React, { useState } from "react";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primeflex/primeflex.css";
import { AutoComplete } from "primereact/autocomplete";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";

import { ExerciseSelector } from "./ePicker";
import { SearchPanel } from "./searchPanel";

import { Message } from "primereact/message";
import { Panel } from "primereact/panel";
import { SelectButton } from "primereact/selectbutton";
import { TabView, TabPanel } from "primereact/tabview";

import "primeicons/primeicons.css";
import Preview from "../renderers/preview.jsx";
import {
  createAssignment,
  fetchAssignmentQuestions,
  selectAll,
  selectDesc,
  selectDue,
  selectId,
  selectKind,
  selectName,
  selectPoints,
  sendAssignmentUpdate,
  setDesc,
  setDue,
  setFromSource,
  setId,
  setIsPeer,
  setIsTimed,
  setKind,
  setName,
  setNoFeedback,
  setNoPause,
  setPeerAsyncVisible,
  setPoints,
  setReleased,
  setTimeLimit,
  setVisible
} from "../state/assignment/assignSlice";

import { EditorContainer, EditorChooser } from "./editorModeChooser.jsx";

//
// subscribe to the store and update the assignment when it changes
// todo: explore moving this into state.js ??
//
function select(state) {
  return state.assignment;
}

function diff(oldobj, newobj) {
  if (!oldobj || !newobj) {
    return {};
  }
  const diff = Object.entries({ ...oldobj, ...newobj }).filter(
    ([key]) => oldobj[key] !== newobj[key]
  );

  return Object.fromEntries(diff);
}
let currentValue;

// function handleChange() {
//   // add a slight delay to prevent multiple updates
//   setTimeout(() => {
//     let previousValue = currentValue;
//
//     currentValue = select(store.getState());
//
//     if (currentValue && previousValue !== currentValue) {
//       if (currentValue.id !== 0 && previousValue && previousValue.id !== 0) {
//         let changes = diff(previousValue, currentValue);
//         let keys = Object.keys(changes);
//         let updateKeys = [
//           "duedate",
//           "points",
//           "visible",
//           "time_limit",
//           "peer_async_visible",
//           "is_peer",
//           "is_timed",
//           "nopause",
//           "nofeedback",
//           "description"
//         ];
//         let update = keys.filter((k) => updateKeys.includes(k));
//
//         if (update.length > 0 && keys.indexOf("id") === -1) {
//           console.log(`updating assignment ${update}`);
//           let toSend = structuredClone(currentValue);
//
//           delete toSend.all_assignments;
//           delete toSend.exercises;
//           store.dispatch(sendAssignmentUpdate(toSend));
//           console.log("changes", changes);
//         }
//       }
//     } else {
//       //console.log("no changes")
//     }
//   }, 1500);
// }

//const unsubscribe = store.subscribe(handleChange); // eslint-disable-line

// The AssignmentEditor component is a form that allows the user to create or edit an assignment.
// The form has fields for the name, description, due date, and total points.
/**
 * @function AssignmentEditor
 * @description This component is a form that allows the user to create or edit an assignment.
 * it uses several additional components to allow the user to search for exercises, write exercises, or choose exercises.
 * The form has fields for the name, description, due date, and total points. As well as advanced options for timed or peer assignments.
 * @returns The AssignmentEditor component
 * @namespace AssignmentEditor
 */
function AssignmentEditor() {
  const dispatch = useDispatch();
  const name = useSelector(selectName);
  const desc = useSelector(selectDesc);
  const due = useSelector(selectDue);
  const points = useSelector(selectPoints);
  const assignData = useSelector(selectAll);
  const [items, setItems] = useState(assignData.all_assignments.map((a) => a.name));
  const search = (e) => {
    setItems(
      assignData.all_assignments.filter((a) => a.name.toLowerCase().includes(e.query.toLowerCase()))
    );
  };

  const chooseOrNameAssignment = (e) => {
    console.log(`in choseOrName ${e.value} items: ${items}`);
    // This is a bit tricky.
    // if e.value is an object then we are selecting an existing assignment
    // if e.value is a string then we are still searching
    // occasionally we get a hiccup where items isn't yet updated so will only create when
    // the button is clicked.
    if (typeof e.value === "string") {
      dispatch(setName(e.value));
    } else {
      console.log(`choosing current assignment ${e.value.name}`);
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
      dispatch(setVisible(current.visible));
      dispatch(setIsPeer(current.is_peer));
      dispatch(setIsTimed(current.is_timed));
      dispatch(setFromSource(current.from_source));
      dispatch(setReleased(current.released));
      dispatch(setTimeLimit(current.time_limit));
      dispatch(setNoFeedback(current.nofeedback));
      dispatch(setNoPause(current.nopause));
      dispatch(setPeerAsyncVisible(current.peer_async_visible));
      dispatch(fetchAssignmentQuestions(current.id));
      if (current.is_peer) {
        dispatch(setKind("Peer"));
      } else if (current.is_timed) {
        dispatch(setKind("Timed"));
      }
    }
  };

  const newAssignment = () => {
    // called when the create button is clicked.
    let assignment = {
      name: name,
      description: desc,
      duedate: due,
      points: points
    };

    dispatch(createAssignment(assignment));
    // reset items so create button disappears
    setItems(assignData.all_assignments.map((a) => a.name));
  };
  let placeDate = new Date(due);
  const [datetime12h, setDatetime12h] = useState(placeDate);

  // We use two representations because the Calendar, internally wants a date
  // but Redux gets unhappy with a Date object because its not serializable.
  // So we use a string for Redux and a Date object for the Calendar.
  const handleDueChange = (e) => {
    setDatetime12h(e.value);
    console.log(`due change ${datetime12h} ${e.value}`);
    let d = e.value.toISOString().replace("Z", "");

    dispatch(setDue(d));
  };

  return (
    <div className="App">
      <div className="p-fluid">
        <div className="p-field p-grid">
          <label htmlFor="name">Assignment Name</label>
          <AutoComplete
            className="field"
            id="name"
            field="name"
            suggestions={items}
            completeMethod={search}
            placeholder="Enter or select assignment name... start typing"
            value={name}
            onChange={chooseOrNameAssignment}
            dropdown
          />
          {items.length == 0 && name ? (
            <Button type="button" className="mb-3 md:mb-0" onClick={newAssignment}>
              Create New
            </Button>
          ) : null}
          <label htmlFor="desc">Assignment Description</label>
          <InputText
            id="desc"
            className="field"
            placeholder="Enter assignment description"
            value={desc}
            onChange={(e) => dispatch(setDesc(e.target.value))}
          />
          <div className="contain2col">
            <div className="item">
              <label htmlFor="due">Due</label>
              <Calendar
                className="field"
                dateFormat="m/d/yy,"
                id="due"
                value={datetime12h}
                placeholder={placeDate.toLocaleString()}
                onChange={handleDueChange}
                showTime
                hourFormat="12"
                stepMinute={5}
              />
            </div>

            <div className="item">
              <label htmlFor="points">Total Points</label>
              <InputNumber
                id="points"
                disabled
                className="field"
                placeholder="Points"
                value={points}
                onChange={(e) => dispatch(setPoints(e.value))}
              />
              <div className="field grid">
                <label className="col-fixed" htmlFor="visible">
                  Visible to Students
                </label>
                <InputSwitch
                  id="visible"
                  className="field"
                  checked={assignData.visible}
                  onChange={(e) => dispatch(setVisible(e.value))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MoreOptions() {
  const options = [
    { label: "Regular", value: "Regular" },
    { label: "Quiz / Exam", value: "Timed" },
    { label: "Peer Instruction", value: "Peer" }
  ];
  const assignData = useSelector(selectAll);
  const assignmentKind = useSelector(selectKind);
  var kind = "";

  if (assignData.is_peer) {
    kind = "Peer";
  } else if (assignData.is_timed) {
    kind = "Timed";
  } else {
    kind = "Regular";
  }
  // todo - set assignmentKind in the store

  console.log("assignment kind = ", assignmentKind, kind);
  const changeAssigmentKind = (e) => {
    dispatch(setKind(e.value));
    if (e.value === "Timed") {
      dispatch(setIsTimed(true));
      dispatch(setIsPeer(false));
    } else if (e.value === "Peer") {
      dispatch(setIsTimed(false));
      dispatch(setIsPeer(true));
    } else {
      dispatch(setIsTimed(false));
      dispatch(setIsPeer(false));
    }
  };
  const dispatch = useDispatch();
  const renderOptions = () => {
    if (assignmentKind === "Timed") {
      return (
        <>
          <div className="p-inputgroup">
            <span className="p-inputgroup-addon">
              <i className="pi pi-clock">time</i>
            </span>
            <InputNumber
              id="timeLimit"
              placeholder="Time Limit (minutes)"
              value={assignData.timeLimit}
              onChange={(e) => dispatch(setTimeLimit(e.value))}
            />
            <span className="p-inputgroup-addon">minutes</span>
          </div>
          <label htmlFor="feedback">Allow Feedback</label>
          <InputSwitch
            id="feedback"
            checked={assignData.feedback}
            onChange={(e) => dispatch(setNoFeedback(e.value))}
          />
          <label htmlFor="allowPause">Allow Pause</label>
          <InputSwitch
            id="allowPause"
            checked={assignData.allowPause}
            onChange={(e) => dispatch(setNoPause(e.value))}
          />
        </>
      );
    } else if (assignmentKind === "Peer") {
      return (
        <>
          <label htmlFor="showAsync">Show Async Peer</label>
          <InputSwitch
            id="showAsync"
            checked={assignData.showAsync}
            onChange={(e) => dispatch(setPeerAsyncVisible(e.value))}
          />
        </>
      );
    } else {
      return <p>No additional options</p>;
    }
  };

  return (
    <div className="App">
      <Panel header="More Options" collapsed={true} toggleable>
        <div className="p-fluid">
          <div className="p-field p-grid">
            <label htmlFor="name">What kind of Assignment?</label>
            <SelectButton value={assignmentKind} onChange={changeAssigmentKind} options={options} />
          </div>
          {renderOptions()}
        </div>
      </Panel>
    </div>
  );
}

export function AddQuestionTabGroup() {
  const [activeIndex, setActiveIndex] = useState(0);
  let assignmentId = useSelector(selectId);
  // if assignmentId is 0 then we haven't selected an assignment yet
  // don't give the user the option to add questions until they have selected an assignment

  if (assignmentId === 0) {
    return (
      <div className="App card flex justify-content-center">
        <Message text="Please select or create an assignment to add exercises." />
      </div>
    );
  }
  return (
    <div className="App">
      <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
        <TabPanel header="Choose Readings">
          <ExerciseSelector level="subchapter" />
        </TabPanel>
        <TabPanel header="Choose Exercises">
          <ExerciseSelector />
        </TabPanel>
        <TabPanel header="Search for Exercises">
          <SearchPanel />
        </TabPanel>
        <TabPanel header="Write an Exercise">
          <EditorChooser />
          <EditorContainer />
          <Preview />
        </TabPanel>
      </TabView>
    </div>
  );
}

export default AssignmentEditor;
