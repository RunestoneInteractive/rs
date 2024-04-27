import React from "react";

import { useSelector, useDispatch } from "react-redux";
import { Toaster } from 'react-hot-toast';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Panel } from 'primereact/panel';
import { ChapterSelector } from "./chapterSelector.jsx";
import {
    setQpoints,
    selectUniqueId,
    selectQpoints,
    setUniqueId,
} from "../state/interactive/interactiveSlice";

import { saveAssignmentQuestion } from "../state/interactive/interactiveSlice";
import { selectAll as selectAssignAll } from "../state/assignment/assignSlice";
import { sumPoints } from "../state/assignment/assignSlice";

const acStyle = {
    border: "1px solid black",
    padding: "10px",
};
/**
 * 
 * @returns The ActiveCodeCreator component
 * @description This component is a container for the common parts of an assignment question.
 * @namespace ActiveCodeEditor
 * 
 */
export function ComponentCreator({component}) {
    // use these selectors to get the values from the store (slice for activecode)
    const uniqueId = useSelector(selectUniqueId);
    const qpoints = useSelector(selectQpoints);
    const dispatch = useDispatch();
    const assignData = useSelector(selectAssignAll);


    return (
        <div style={acStyle}>
            <Toaster />
            <div className="contain2col">
                <div className="item">
                    <label htmlFor="qpoints">Points</label>
                    <InputNumber
                        id="qpoints"
                        placeholder="Points"
                        value={qpoints}
                        onChange={(e) => {
                            dispatch(setQpoints( e.value));
                            dispatch(sumPoints());
                        }}
                    />
                </div>
            </div>
            <div>
                <label htmlFor="uniqueId">
                    Question Name
                </label>
                <InputText
                    id="uniqueId"
                    placeholder="Enter Question Name"
                    value={uniqueId}
                    onChange={(e) =>
                        dispatch(setUniqueId(e.target.value))
                    }
                />
                <label htmlFor="chapSelect">Chapter</label>
                <ChapterSelector />

                {component}

                <Panel header="More Options" collapsed={true} toggleable >
                    <div className="formgrid grid">
                        <div className="field col">
                            <label htmlFor="author">Author</label>
                            <InputText id="author" placeholder="Author" />
                        </div>
                        <div className="field col">
                            <label htmlFor="tags">Tags</label>
                            <InputText id="tags" placeholder="Tags" className="field" />
                        </div>
                        <div>
                            <label htmlFor="difficulty">Difficulty</label>
                            <InputNumber id="difficulty" placeholder="Difficulty" className="field" />
                        </div>
                        <div className="field col">
                            <label htmlFor="topic">Topic</label>
                            <InputText id="topic" placeholder="Topic" className="field" />
                        </div>
                    </div>

                </Panel>
            </div>
            <Button
                value="save"
                onClick={() =>
                    dispatch(
                        saveAssignmentQuestion({
                            assignData: assignData,
                        })
                    )
                }
            >
                Save &amp; Add
            </Button>
        </div>
    );
}

export default ComponentCreator;
