/**
 *
 * @file ePicker.jsx
 * @summary A component to select exercises from a tree table
 * @description This file defines a component that is a tree table that displays the exercises in the ePicker.
 * The user can select exercises to add to the assignment.
 * This table uses the PrimeReact library.
 *
 * The epicker makes use of several APIs to fetch the data for a particular eBook.
 * The state is maintained in the redux store. See the ePickerSlice for more details.
 *
 */
import { TreeTable } from "@components/ui/TreeTable";
import PropTypes from "prop-types";
import { useSelector, useDispatch } from "react-redux";

import { getSelectedKeys } from "@/utils/exercise";

import { setExerciseDefaults, setReadingDefaults } from "../exUtils";
import {
  addExercise,
  selectExercises,
  selectId,
  sendExercise,
  deleteExercises,
  sendDeleteExercises,
  sumPoints
} from "../state/assignment/assignSlice";
import { chooserNodes } from "../state/epicker/ePickerSlice";

import { PreviewTemplate } from "./searchPanel";

/**
 * @function ExerciseSelector
 * @param {object} props
 * @description This component is a tree table that displays the exercises in the ePicker.
 * @returns The ExerciseSelector component
 * @namespace ePicker
 */
export function ExerciseSelector(props) {
  var nodes;

  if (props.level === "subchapter") {
    console.log("subchapter");
    nodes = useSelector((state) => state.ePicker.readingNodes);
  } else {
    nodes = useSelector(chooserNodes);
  }
  const dispatch = useDispatch();

  let filteredNodes = structuredClone(nodes);
  let currentExercises = useSelector(selectExercises);
  let currentAssignmentId = useSelector(selectId);

  /**
   * @function doSelect
   * @param {event} event
   * @description This function is called when a user selects an exercise from the tree table.
   * The function adds the exercise to the current assignment and sends the exercise to the server.
   * @memberof ePicker
   */
  function doSelect(event) {
    console.log(event.node);
    // if the node has children then we need to traverse down the tree to the leaves
    // we only want to add the leaves to the current assignment
    if (event.node.children) {
      for (let child of event.node.children) {
        doSelect({ node: child });
      }
    }
    let exercise = event.node.data;

    if (props.level === "subchapter") {
      exercise = setReadingDefaults(exercise, currentAssignmentId, currentExercises);
    } else {
      if (!exercise.name) return; // not an exercise
      exercise = setExerciseDefaults(exercise, currentAssignmentId, currentExercises);
    }
    dispatch(addExercise(exercise));
    dispatch(sendExercise(exercise));
    // dispatching addExercise does not modify the currentExercises array
    dispatch(sumPoints());
  }

  /**
   * @function doUnSelect
   * @param {event} event
   * @description This function is called when a user unselects an exercise from the tree table.
   * The function removes the exercise from the current assignment and sends the delete request to the server.
   * @memberof ePicker
   */
  function doUnSelect(event) {
    console.log(event.node);
    // find the exercise in the currentExercises and remove it
    if (event.node.children) {
      for (let child of event.node.children) {
        doUnSelect({ node: child });
      }
    }
    let exercise = event.node.data;

    if (!exercise) {
      return; // not an exercise
    }
    dispatch(deleteExercises([exercise]));
    dispatch(sendDeleteExercises([exercise]));
    dispatch(sumPoints());
  }

  if (props.level === "subchapter") {
    for (let node of filteredNodes) {
      for (let child of node.children) {
        delete child.children;
      }
    }
    return (
      <div className="card">
        <TreeTable
          value={filteredNodes}
          selectionKeys={getSelectedKeys(filteredNodes, currentExercises)}
          onSelect={(node) => doSelect({ node })}
          onUnselect={(node) => doUnSelect({ node })}
          ariaLabel="Readings"
          columns={[{ header: "Title", render: (node) => node.data?.title }]}
        />
      </div>
    );
  }
  for (let node of filteredNodes) {
    for (let child of node.children) {
      child.children = child.children.filter((child) => child.data.question_type !== "page");
    }
  }
  return (
    <div className="card">
      <TreeTable
        value={filteredNodes}
        selectionKeys={getSelectedKeys(filteredNodes, currentExercises)}
        onSelect={(node) => doSelect({ node })}
        onUnselect={(node) => doUnSelect({ node })}
        ariaLabel="Exercises"
        columns={[
          { header: "Title", width: "25rem", render: (node) => node.data?.title },
          { header: "Question Number", width: "10rem", render: (node) => node.data?.qnumber },
          { header: "Preview", width: "8rem", render: (node) => PreviewTemplate(node) },
          { header: "QuestionName", width: "10rem", render: (node) => node.data?.name },
          { header: "Question Type", width: "10rem", render: (node) => node.data?.question_type }
        ]}
      />
    </div>
  );
}

ExerciseSelector.propTypes = {
  level: PropTypes.string
};
export default ExerciseSelector;
