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
import { useSelector, useDispatch } from "react-redux";
import React from "react";
import { TreeTable } from 'primereact/treetable';
import { Column } from 'primereact/column';
import { chooserNodes, setSelectedNodes, selectedNodes } from "../state/epicker/ePickerSlice";
import {
    addExercise,
    selectExercises,
    selectId,
    sendExercise,
    deleteExercises,
    sendDeleteExercises,
    sumPoints,
} from "../state/assignment/assignSlice";
import { setExerciseDefaults, setReadingDefaults } from "../exUtils";
import PropTypes from 'prop-types';

/**
 * @function ExerciseSelector
 * @param {object} props 
 * @description This component is a tree table that displays the exercises in the ePicker.
 * @returns The ExerciseSelector component
 * @namespace ePicker
 */
export function ExerciseSelector(props) {
    const nodes = useSelector(chooserNodes)
    const dispatch = useDispatch();

    let filteredNodes = structuredClone(nodes);
    let currentExercises = useSelector(selectExercises);
    let currentAssignmentId = useSelector(selectId);
    let selectedNodeKeys = useSelector(selectedNodes);

    // The initially selected nodes are initialized in the redux store
    // by the fetchAssignmentQuestions thunk

    //
    // event handling functions
    //
    function handleSelectionChange(e) {
        dispatch(setSelectedNodes(e.value));
    }


    /**
     * @function doSelect
     * @param {event} event 
     * @description This function is called when a user selects an exercise from the tree table.
     * The function adds the exercise to the current assignment and sends the exercise to the server.
     * @memberof ePicker
     */
    function doSelect(event) {
        console.log(event.node);
        let exercise = event.node.data;
        if (props.level === "subchapter") {
            exercise = setReadingDefaults(exercise, currentAssignmentId, currentExercises);
        } else {
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
        let exercise = event.node.data;
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
                <TreeTable value={filteredNodes}
                    selectionMode="checkbox"
                    selectionKeys={selectedNodeKeys}
                    onSelect={doSelect}
                    onUnselect={doUnSelect}
                    onSelectionChange={handleSelectionChange} tableStyle={{ minWidth: '10rem' }}>
                    <Column field="title" header="Title" expander></Column>
                </TreeTable>
            </div>
        )
    }
    for (let node of filteredNodes) {
        for (let child of node.children) {
            child.children = child.children.filter((child) => child.data.question_type !== "page");
        }
    }
    return (
        <div className="card">
            <TreeTable value={filteredNodes}
                selectionMode="checkbox"
                selectionKeys={selectedNodeKeys}
                onSelectionChange={handleSelectionChange}
                onSelect={doSelect}
                onUnselect={doUnSelect}
                tableStyle={{ minWidth: '10rem' }}
                scrollable
                scrollHeight="400px"
            >
                <Column field="title" header="Title" expander style={{ width: '25rem' }}></Column>
                <Column field="qnumber" header="Question Number" style={{ width: '10rem' }}></Column>
                <Column field="name" header="QuestionName" style={{ width: '10rem' }}></Column>
                <Column field="question_type" header="Question Type" style={{ width: '10rem' }}></Column>
            </TreeTable>
        </div>
    )
}

ExerciseSelector.propTypes = {
    level: PropTypes.string,
}
export default ExerciseSelector;