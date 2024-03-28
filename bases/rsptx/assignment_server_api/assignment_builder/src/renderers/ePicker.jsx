import { useSelector, useDispatch } from "react-redux";
import { useState, useEffect } from "react";
import { TreeTable } from 'primereact/treetable';
import { Column } from 'primereact/column';
import { chooserNodes } from "../state/epicker/ePickerSlice";

// todo: Add attribute to indicate whether this is a question or a subchapter
export function ExerciseSelector({ level }) {
    const nodes = useSelector(chooserNodes)
    // maybe keep this as I don't know it has to be global.
    const [selectedNodeKeys, setSelectedNodeKeys] = useState(null);
    let filteredNodes = structuredClone(nodes);

    if (level === "subchapter") {
        for (let node of filteredNodes) {
            for (let child of node.children) {
                delete child.children;
            }
        }
        return (
            <div className="card">
                <TreeTable value={filteredNodes} selectionMode="checkbox" selectionKeys={selectedNodeKeys} onSelectionChange={(e) => setSelectedNodeKeys(e.value)} tableStyle={{ minWidth: '10rem' }}>
                    <Column field="title" header="Title" expander></Column>
                </TreeTable>
            </div>
        )
    }
    return (
        <div className="card">
            <TreeTable value={filteredNodes} selectionMode="checkbox" selectionKeys={selectedNodeKeys} onSelectionChange={(e) => setSelectedNodeKeys(e.value)} tableStyle={{ minWidth: '10rem' }}>
                <Column field="title" header="Title" expander></Column>
                <Column field="qnumber" header="Question Number"></Column>
                <Column field="name" header="QuestionName"></Column>
                <Column field="question_type" header="Question Type"></Column>
            </TreeTable>
        </div>
    )
}

export default ExerciseSelector;