import { useSelector, useDispatch } from "react-redux";
import { useState, useEffect } from "react";
import { TreeTable } from 'primereact/treetable';
import { Column } from 'primereact/column';
import { chooserNodes, setSelectedNodes, selectedNodes } from "../state/epicker/ePickerSlice";
import { addExercise, selectExercises, selectId, sendExercise, deleteExercises, sendDeleteExercises } from "../state/assignment/assignSlice";
import { current } from "@reduxjs/toolkit";

// todo: Add attribute to indicate whether this is a question or a subchapter
export function ExerciseSelector({ level }) {
    const nodes = useSelector(chooserNodes)
    const dispatch = useDispatch();
    // todo: This needs to be in redux and should match up with the current assignment
    // see https://primereact.org/treetable/

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

    // Add a question to the current assignment
    // But, we can ignore the partially selected nodes and just use this to keep the UI in sync
    function doSelect(event) {
        console.log(event.node);
        let exercise = event.node.data;
        exercise.name = exercise.name.substring(2);
        exercise.assignment_id = currentAssignmentId;
        exercise.question_id = exercise.id;
        let clen = currentExercises.length;
        exercise.points = clen ? currentExercises[clen - 1].points : 1;
        exercise.autograde = clen ? currentExercises[clen - 1].autograde : "pct_correct";
        exercise.which_to_grade = clen ? currentExercises[clen - 1].which_to_grade : "best_answer";
        exercise.sorting_priority = clen;
        dispatch(addExercise(exercise));
        dispatch(sendExercise(exercise));

    }

    function doUnSelect(event) {
        console.log(event.node);
        // find the exercise in the currentExercises and remove it
        let exercise = event.node.data;
        dispatch(deleteExercises(exercise));
        dispatch(sendDeleteExercises([exercise.id]));
    }

    if (level === "subchapter") {
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
                    onSelectionChange={handleSelectionChange} tableStyle={{ minWidth: '10rem' }}>
                    <Column field="title" header="Title" expander></Column>
                </TreeTable>
            </div>
        )
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

export default ExerciseSelector;