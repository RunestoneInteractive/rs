import { createActiveCodeTemplate } from "../componentFuncs.js";
import { useSelector, useDispatch } from "react-redux";
import { Toaster } from 'react-hot-toast';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';


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
import { selectPoints, setPoints } from "../state/assignment/assignSlice";
import { selectCode, setCode } from "../state/preview/previewSlice";

const acStyle = {
    border: "1px solid black",
    padding: "10px",
};

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
    const previewCode = useSelector(selectCode);


    const previewOnBlur = (e) => {
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
                                newVal: e.value,
                            })
                        )
                    }
                />
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
                ></InputTextarea>
            </div>
            <Button
                value="save"
                onClick={(e) =>
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
                Save
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
