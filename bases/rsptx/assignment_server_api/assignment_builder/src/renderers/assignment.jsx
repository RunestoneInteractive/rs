/**
 *
 * @fileoverview This file contains the AssignmentEditor component which is a form that allows the user to create or edit an assignment.
 *
 */

import {
  Accordion,
  Alert,
  Autocomplete,
  Button,
  NumberInput,
  SegmentedControl,
  Switch,
  Tabs,
  TextInput
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { IconClock } from "@tabler/icons-react";
import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

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
import { store } from "../state/store";

import { EditorContainer, EditorChooser } from "./editorModeChooser.jsx";
import { ExerciseSelector } from "./ePicker";
import { SearchPanel } from "./searchPanel";

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

function handleChange() {
  // add a slight delay to prevent multiple updates
  setTimeout(() => {
    let previousValue = currentValue;

    currentValue = select(store.getState());

    if (currentValue && previousValue !== currentValue) {
      if (currentValue.id !== 0 && previousValue && previousValue.id !== 0) {
        let changes = diff(previousValue, currentValue);
        let keys = Object.keys(changes);
        let updateKeys = [
          "duedate",
          "points",
          "visible",
          "time_limit",
          "peer_async_visible",
          "is_peer",
          "is_timed",
          "nopause",
          "nofeedback",
          "description"
        ];
        let update = keys.filter((k) => updateKeys.includes(k));

        if (update.length > 0 && keys.indexOf("id") === -1) {
          console.log(`updating assignment ${update}`);
          let toSend = structuredClone(currentValue);

          delete toSend.all_assignments;
          delete toSend.exercises;
          store.dispatch(sendAssignmentUpdate(toSend));
          console.log("changes", changes);
        }
      }
    } else {
      //console.log("no changes")
    }
  }, 1500);
}

const unsubscribe = store.subscribe(handleChange); // eslint-disable-line

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

  const chooseOrNameAssignment = (value) => {
    setItems(
      assignData.all_assignments
        .filter((a) => a.name.toLowerCase().includes((value || "").toLowerCase()))
        .map((a) => a.name)
    );

    const current = assignData.all_assignments.find((a) => a.name === value);

    if (!current) {
      dispatch(setName(value));
      return;
    }
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
  const handleDueChange = (value) => {
    if (!value) {
      return;
    }
    const d = new Date(value);

    setDatetime12h(d);
    dispatch(setDue(d.toISOString().replace("Z", "")));
  };

  return (
    <div className="App">
      <div className="p-fluid">
        <div className="p-field p-grid">
          <label htmlFor="name">Assignment Name</label>
          <Autocomplete
            className="field"
            id="name"
            data={assignData.all_assignments.map((a) => a.name)}
            placeholder="Enter or select assignment name... start typing"
            value={name}
            onChange={chooseOrNameAssignment}
          />
          {items.length == 0 && name ? (
            <Button type="button" className="mb-3 md:mb-0" onClick={newAssignment}>
              Create New
            </Button>
          ) : null}
          <label htmlFor="desc">Assignment Description</label>
          <TextInput
            id="desc"
            className="field"
            placeholder="Enter assignment description"
            value={desc}
            onChange={(e) => dispatch(setDesc(e.target.value))}
          />
          <div className="contain2col">
            <div className="item">
              <label htmlFor="due">Due</label>
              <DateTimePicker
                className="field"
                valueFormat="MM/DD/YYYY, hh:mm A"
                id="due"
                value={datetime12h}
                placeholder={placeDate.toLocaleString()}
                onChange={handleDueChange}
              />
            </div>

            <div className="item">
              <label htmlFor="points">Total Points</label>
              <NumberInput
                id="points"
                disabled
                className="field"
                placeholder="Points"
                value={points}
                onChange={(value) => dispatch(setPoints(value))}
              />
              <div className="field grid">
                <label className="col-fixed" htmlFor="visible">
                  Visible to Students
                </label>
                <Switch
                  id="visible"
                  className="field"
                  checked={assignData.visible}
                  onChange={(e) => dispatch(setVisible(e.currentTarget.checked))}
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
  const dispatch = useDispatch();
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
  const changeAssigmentKind = (value) => {
    dispatch(setKind(value));
    if (value === "Timed") {
      dispatch(setIsTimed(true));
      dispatch(setIsPeer(false));
    } else if (value === "Peer") {
      dispatch(setIsTimed(false));
      dispatch(setIsPeer(true));
    } else {
      dispatch(setIsTimed(false));
      dispatch(setIsPeer(false));
    }
  };
  const renderOptions = () => {
    if (assignmentKind === "Timed") {
      return (
        <>
          <div className="p-inputgroup">
            <span className="p-inputgroup-addon">
              <IconClock size={16} />
            </span>
            <NumberInput
              id="timeLimit"
              placeholder="Time Limit (minutes)"
              value={assignData.timeLimit}
              onChange={(value) => dispatch(setTimeLimit(value))}
            />
            <span className="p-inputgroup-addon">minutes</span>
          </div>
          <label htmlFor="feedback">Allow Feedback</label>
          <Switch
            id="feedback"
            checked={assignData.feedback}
            onChange={(e) => dispatch(setNoFeedback(e.currentTarget.checked))}
          />
          <label htmlFor="allowPause">Allow Pause</label>
          <Switch
            id="allowPause"
            checked={assignData.allowPause}
            onChange={(e) => dispatch(setNoPause(e.currentTarget.checked))}
          />
        </>
      );
    } else if (assignmentKind === "Peer") {
      return (
        <>
          <label htmlFor="showAsync">Show Async Peer</label>
          <Switch
            id="showAsync"
            checked={assignData.showAsync}
            onChange={(e) => dispatch(setPeerAsyncVisible(e.currentTarget.checked))}
          />
        </>
      );
    } else {
      return <p>No additional options</p>;
    }
  };

  return (
    <div className="App">
      <Accordion>
        <Accordion.Item value="more-options">
          <Accordion.Control>More Options</Accordion.Control>
          <Accordion.Panel>
            <div className="p-fluid">
              <div className="p-field p-grid">
                <label htmlFor="name">What kind of Assignment?</label>
                <SegmentedControl
                  value={assignmentKind}
                  onChange={changeAssigmentKind}
                  data={options}
                />
              </div>
              {renderOptions()}
            </div>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
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
        <Alert>Please select or create an assignment to add exercises.</Alert>
      </div>
    );
  }
  return (
    <div className="App">
      <Tabs value={String(activeIndex)} onChange={(value) => setActiveIndex(Number(value))}>
        <Tabs.List>
          <Tabs.Tab value="0">Choose Readings</Tabs.Tab>
          <Tabs.Tab value="1">Choose Exercises</Tabs.Tab>
          <Tabs.Tab value="2">Search for Exercises</Tabs.Tab>
          <Tabs.Tab value="3">Write an Exercise</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="0">
          <ExerciseSelector level="subchapter" />
        </Tabs.Panel>
        <Tabs.Panel value="1">
          <ExerciseSelector />
        </Tabs.Panel>
        <Tabs.Panel value="2">
          <SearchPanel />
        </Tabs.Panel>
        <Tabs.Panel value="3">
          <EditorChooser />
          <EditorContainer />
          <Preview />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

export default AssignmentEditor;
