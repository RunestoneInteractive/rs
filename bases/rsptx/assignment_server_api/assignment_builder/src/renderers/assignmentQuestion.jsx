/**
 * 
 * @file assignmentQuestion.jsx
 * @summary A component to display the questions in the assignment
 * @description This component is a table that displays the questions in the assignment.
 * The table is editable and the user can change the points, autograde, and which_to_grade fields.
 * Questions can be reordered and deleted.
 * This table uses the Handsontable library.
 * @memberof AssignmentEditor
 */
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Panel } from 'primereact/panel';
import 'handsontable/dist/handsontable.full.min.css';
import { registerAllModules } from 'handsontable/registry';
import { HotTable } from '@handsontable/react';
import { fetchChooserData } from "../state/epicker/ePickerSlice";
import { unSelectNode } from "../state/epicker/ePickerSlice";
import {
    selectExercises,
    updateExercise,
    sendExercise,
    deleteExercises,
    reorderExercise,
    reorderAssignmentQuestions,
    sendDeleteExercises,
    sumPoints,
} from '../state/assignment/assignSlice';
import PropTypes from 'prop-types';

// This registers all the plugins for the Handsontable library
registerAllModules();

export const problemColumns = ["id", "qnumber", "points", "autograde", "which_to_grade"];
export const problemColumnSpec = [{ type: "numeric", readOnly: true },
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
]
export const readingColumns = ["id", "chapter", "subchapter", "numQuestions", "required", "points"];
export const readingColumnSpec = [
    { type: "numeric", readOnly: true },
    { type: "text", readOnly: true },
    { type: "text", readOnly: true },
    { type: "numeric", readOnly: true },
    { type: "numeric" },
    { type: "numeric" }
]

/**
 * @function AssignmentQuestion
 * @summary The AssignmentQuestion component
 * @description This component is a table that displays the questions in the assignment.
 * The table is editable and the user can change the points, autograde, and which_to_grade fields.
 * Questions can be reordered and deleted.
 * This table uses the Handsontable library.
 * @returns The AssignmentQuestion component
 * @memberof AssignmentEditor
 */
export function AssignmentQuestion(props) {
    const dispatch = useDispatch();
    const question_rows = useSelector(selectExercises);
    console.log("columns", props.columns);

    let hotData = []
    for (let row of question_rows) {
        let newRow = []
        for (let col of props.columns) {
            newRow.push(row[col])
        }
        if (props.isReading && row.reading_assignment) {
            hotData.push(newRow)
        } else if (!props.isReading && !row.reading_assignment) {
            hotData.push(newRow)
        }
    }

    const findRowById = (id) => {
        for (let row of question_rows) {
            if (row.id === id) {
                return row;
            }
        }
        return null;
    }
    const handleChange = (change, source) => {
        if (source === "loadData" || source === "updateData") {
            return;
        }
        console.log(change); // gives us [row, column, oldVal, newVal]
        console.log(hotData);
        let changeKey = props.columns[change[0][1]];
        for (let c of change) {
            let row = c[0];
            let col = c[1];
            let oldVal = c[2];
            let newVal = c[3];
            let id = hotData[row][0];
            let key = props.columns[col];
            let new_row = structuredClone(findRowById(id));
            new_row[key] = newVal;
            if (newVal !== oldVal) {
                dispatch(updateExercise({ id: id, exercise: new_row }))
                dispatch(sendExercise(new_row))
            }
        }
        if (changeKey === "points") {
            dispatch(sumPoints());
        }
    };

    const handleDelete = (start, amount) => {
        // Called by the afterRemoveRow hook in HotTable
        // by the time this is called hotData is already updated and the row is gone.
        console.log("delete row", start, amount);
        for (let row of hotData) {
            console.log(row);
        }
        let toRemove = question_rows.slice(start, start + amount);
        let namesToRemove = question_rows.slice(start, start + amount).map(ex => ex.name);
        try {
            dispatch(deleteExercises(toRemove));
            dispatch(sendDeleteExercises(toRemove));
            dispatch(sumPoints())
            dispatch(fetchChooserData({ skipreading: false, from_source_only: true, pages_only: false }));
            dispatch(unSelectNode(namesToRemove));
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
            <Panel header={props.headerTitle} toggleable>
                <HotTable
                    style={aqStyle}
                    width="100%"
                    data={hotData}
                    stretchH="all"
                    colHeaders={props.columns}
                    rowHeaders={true}
                    manualRowMove={true}
                    contextMenu={true}
                    allowRemoveRow={true}
                    hiddenColumns={{ columns: [0] }}
                    columns={props.columnSpecs}
                    afterChange={handleChange}
                    afterRowMove={handleReorder}
                    afterRemoveRow={handleDelete}
                    licenseKey="non-commercial-and-evaluation"
                />
            </Panel>
        </div>
    );
}

AssignmentQuestion.propTypes = {
    headerTitle: PropTypes.string,
    columns: PropTypes.array,
    columnSpecs: PropTypes.array,
    isReading: PropTypes.bool,
};
