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
    setPoints,
} from '../state/assignment/assignSlice';

// This registers all the plugins for the Handsontable library
registerAllModules();

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
            let totalPoints = 0;
            for (let ex of hotData) {
                if (toRemove.includes(ex.id) === false) {
                    totalPoints += ex[2];
                }
            }
            dispatch(setPoints(totalPoints));
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
