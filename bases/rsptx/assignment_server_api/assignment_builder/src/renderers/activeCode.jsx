import React from "react";
import { createActiveCodeTemplate } from "../componentFuncs.js";
import { useSelector, useDispatch } from "react-redux";
import { Toaster } from 'react-hot-toast';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Panel } from 'primereact/panel';
import { ChapterSelector } from "./chapterSelector.jsx";
import {
    updateField,
    selectId,
    selectInstructions,
    selectLanguage,
    selectQpoints,
    selectStarterCode,
    selectPrefixCode,
    selectSuffixCode,
    selectAll,
    saveAssignmentQuestion,
} from "../state/activecode/acSlice";

import { selectAll as selectAssignAll } from "../state/assignment/assignSlice";
import { setPoints } from "../state/assignment/assignSlice";
import { setCode } from "../state/preview/previewSlice";

const acStyle = {
    border: "1px solid black",
    padding: "10px",
};
/**
 * 
 * @returns The ActiveCodeCreator component
 * @description This component creates the ActiveCodeCreator component which allows the user to create an activecode component.
 * @namespace ActiveCodeEditor
 * 
 */
function ActiveCodeCreator() {
    // use these selectors to get the values from the store (slice for activecode)
    const uniqueId = useSelector(selectId);
    const instructions = useSelector(selectInstructions);
    const language = useSelector(selectLanguage);
    const qpoints = useSelector(selectQpoints);
    const starter_code = useSelector(selectStarterCode);
    const prefix_code = useSelector(selectPrefixCode);
    const suffix_code = useSelector(selectSuffixCode);
    const dispatch = useDispatch();
    const acData = useSelector(selectAll);
    const assignData = useSelector(selectAssignAll);


    const previewOnBlur = () => {
        dispatch(
            setCode(
                createActiveCodeTemplate(
                    uniqueId,
                    instructions,
                    language,
                    prefix_code,
                    starter_code,
                    suffix_code
                )
            )
        );
    };

    const languageOptions = [
        { value: "python", label: "Python (in browser)" },
        { value: "java", label: "Java" },
        { value: "cpp", label: "C++" },
        { value: "c", label: "C" },
        { value: "javascript", label: "Javascript" },
        { value: "html", label: "HTML" },
        { value: "sql", label: "SQL" },
    ]

    return (
        <div style={acStyle}>
            <Toaster />
            <div className="contain2col">
                <div className="item">
                    <label htmlFor="language">
                        Language
                    </label>
                    <Dropdown
                        id="language"
                        value={language}
                        onChange={(e) => dispatch(updateField({ field: "language", newVal: e.value }))}
                        options={languageOptions}
                        optionLabel="label"
                    />

                </div>
                <div className="item">
                    <InputNumber
                        id="qpoints"
                        placeholder="Points"
                        value={qpoints}
                        onChange={(e) => {
                            dispatch(updateField({ field: "qpoints", newVal: e.value }));
                            dispatch(setPoints(Number(e.value)));
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
                    onBlur={previewOnBlur}
                    onChange={(e) =>
                        dispatch(
                            updateField({
                                field: "uniqueId",
                                newVal: e.target.value,
                            })
                        )
                    }
                />
                <label htmlFor="chapSelect">Chapter</label>
                <ChapterSelector />
                <label htmlFor="instructions" className="builderlabel">
                    Instructions
                </label>
                <InputTextarea
                    rows={3}
                    cols={60}
                    id="instructions"
                    placeholder="Enter Assignment Instructions (HTML Allowed)"
                    value={instructions}
                    onBlur={previewOnBlur}
                    onChange={(e) => dispatch(updateField({ field: "instructions", newVal: e.target.value }))}
                ></InputTextarea>
                <label htmlFor="prefix_code" className="builderlabel">
                    Hidden Prefix Code
                </label>
                <InputTextarea
                    rows={4}
                    cols={60}
                    id="prefix_code"
                    placeholder="Enter Assignment Prefix Code"
                    value={prefix_code}
                    onBlur={previewOnBlur}
                    onChange={(e) => dispatch(updateField({ field: "prefix_code", newVal: e.target.value }))}
                ></InputTextarea>
                <label htmlFor="starter_code" className="builderlabel">
                    Starter Code
                </label>
                <InputTextarea
                    rows={4}
                    cols={60}
                    id="starter_code"
                    placeholder="Enter Assignment Starter Code"
                    value={starter_code}
                    onBlur={previewOnBlur}
                    onChange={(e) => dispatch(updateField({ field: "starter_code", newVal: e.target.value }))}
                ></InputTextarea>
                <label htmlFor="suffix_code" className="builderlabel">
                    Hidden Suffix (Test) Code
                </label>
                <InputTextarea
                    rows={4}
                    cols={60}
                    id="suffix_code"
                    placeholder="Enter Assignment Suffix (unit test) Code"
                    value={suffix_code}
                    onBlur={previewOnBlur}
                    onChange={(e) => {
                        dispatch(
                            updateField({
                                field: "suffix_code",
                                newVal: e.value,
                            })
                        );
                    }}
                >

                </InputTextarea>
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
                            acData: acData,
                            previewSrc: createActiveCodeTemplate(
                                uniqueId,
                                instructions,
                                language,
                                prefix_code,
                                starter_code,
                                suffix_code
                            ),
                        })
                    )
                }
            >
                Save &amp; Add
            </Button>
            <Button
                severity="info"
                value="preview"
                id="preview"
                onClick={(e) => previewOnBlur(e)}
            >
                Preview
            </Button>
        </div>
    );
}

export default ActiveCodeCreator;
