import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Stack from "react-bootstrap/Stack";
import { renderRunestoneComponent } from "./componentFuncs.js";
import Button from "react-bootstrap/Button";
import { useSelector, useDispatch } from "react-redux";

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
} from "./features/activecode/acSlice";

import { useState, useSyncExternalStore } from "react";

const acStyle = {
    border: "1px solid black",
    padding: "10px",
};

function ActiveCodeCreator({ assignData, newExercise }) {
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

    const handleAcDataChange = (e) => {
        // this relies on the fields of the form to have an id that matches the field in the slice
        dispatch(updateField({ field: e.target.id, newVal: e.target.value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // handle a preview button
        console.log(acData);
        if (e.target.value === "preview") {
            document.getElementById("preview_div").innerHTML = preview_src;
            renderRunestoneComponent(preview_src, "preview_div", {});
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        // newExercise(acData);
        // todo fix to allow for updates
        let assignmentId = 0;
        let questionId = 0;
        let jsheaders = new Headers({
            "Content-type": "application/json; charset=utf-8",
            Accept: "application/json",
        });
        let body = {
            name: assignData.name,
            description: assignData.desc,
            duedate: assignData.due,
            points: assignData.points,
            kind: "quickcode",
        };
        let data = {
            body: JSON.stringify(body),
            headers: jsheaders,
            method: "POST",
        };
        let resp = await fetch("/assignment/instructor/new_assignment", data);
        let result = await resp.json();
        if (result.detail.status === "success") {
            console.log("Assignment created");
            assignmentId = result.detail.id;
        }

        // Now add the question
        // these names match the database columns
        body = {
            name: uniqueId,
            question: acData,
            question_type: "activecode",
            source: JSON.stringify(assignData),
            htmlsrc: preview_src,
            question_json: JSON.stringify({ ...acData, ...assignData }),
        };
        data = {
            body: JSON.stringify(body),
            headers: jsheaders,
            method: "POST",
        };
        resp = await fetch("/assignment/instructor/new_question", data);
        result = await resp.json();
        if (result.detail.status === "success") {
            console.log("Question created");
            questionId = result.detail.id;
        }

        //finally add the question to the assignment
        body = {
            assignment_id: assignmentId,
            question_id: questionId,
            points: assignData.points,
        };
        data = {
            body: JSON.stringify(body),
            headers: jsheaders,
            method: "POST",
        };
        resp = await fetch("/assignment/instructor/new_assignment_q", data);
        result = await resp.json();
        if (result.detail.status === "success") {
            console.log("Question added to assignment");
        }
    };

    var preview_src = `
<div class="ptx-runestone-container">
<div class="runestone explainer ac_section ">
<div data-component="activecode" id="${uniqueId}" data-question_Form.Label="4.2.2.2">
<div class="ac_question">
<p>${instructions}</p>

</div>
<textarea data-lang="${language}" id="${uniqueId}_editor"
    data-timelimit=25000  data-codelens="true"  style="visibility: hidden;"
    data-audio=''
    data-wasm=/_static
    >
${prefix_code}
^^^^
${starter_code}
====
${suffix_code}

</textarea>
</div>
</div>
</div>
    `;

    return (
        <div style={acStyle}>
            <Form.Group className="mb-1" as={Row}>
                <Form.Label column sm={2}>
                    Language
                </Form.Label>
                <Col sm={4}>
                    <Form.Select
                        id="language"
                        className="rsform"
                        value={language}
                        onChange={handleAcDataChange}
                    >
                        <option value="python">Python (in browser)</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                        <option value="c">C</option>
                        <option value="javascript">Javascript</option>
                        <option value="html">HTML</option>
                        <option value="sql">SQL</option>
                    </Form.Select>
                </Col>
                <Col sm={2}>
                    <Form.Control
                        id="qpoints"
                        className="rsform"
                        type="number"
                        placeholder="Points"
                        value={qpoints}
                        onChange={handleAcDataChange}
                    />
                </Col>
            </Form.Group>
            <Form.Group className="mb-3">
                <Row>
                    <Form.Label column sm={3}>
                        Question Name
                    </Form.Label>
                    <Form.Control
                        className="rsform w-50"
                        id="uniqueId"
                        type="text"
                        placeholder="Enter Question Name"
                        value={uniqueId}
                        onChange={(e) =>
                            dispatch(
                                updateField({
                                    field: "uniqueId",
                                    newVal: e.target.value,
                                })
                            )
                        }
                    />
                </Row>
                <Form.Label column sm={2}>
                    Instructions
                </Form.Label>
                <Form.Control
                    as="textarea"
                    rows={3}
                    cols={60}
                    id="instructions"
                    className="rsform w-75"
                    placeholder="Enter Assignment Instructions (HTML Allowed)"
                    value={instructions}
                    onChange={handleAcDataChange}
                ></Form.Control>
                <Form.Label column sm={4}>
                    Hidden Prefix Code
                </Form.Label>
                <Form.Control
                    as="textarea"
                    rows="4"
                    cols="60"
                    id="prefix_code"
                    className="rsform w-75"
                    placeholder="Enter Assignment Prefix Code"
                    value={prefix_code}
                    onChange={handleAcDataChange}
                ></Form.Control>
                <Form.Label column sm={2}>
                    Starter Code
                </Form.Label>
                <Form.Control
                    as="textarea"
                    rows="4"
                    cols="60"
                    id="starter_code"
                    className="rsform w-75"
                    placeholder="Enter Assignment Starter Code"
                    value={starter_code}
                    onChange={handleAcDataChange}
                ></Form.Control>
                <Form.Label column sm={4}>
                    Hidden Suffix (Test) Code
                </Form.Label>
                <Form.Control
                    as="textarea"
                    rows="4"
                    cols="60"
                    id="suffix_code"
                    className="rsform w-75"
                    placeholder="Enter Assignment Suffix (unit test) Code"
                    value={suffix_code}
                    onChange={handleAcDataChange}
                ></Form.Control>
            </Form.Group>
            <Stack direction="horizontal" gap={2}>
                <Button
                    variant="primary"
                    type="button"
                    value="save"
                    onClick={handleSave}
                >
                    Save
                </Button>
                <Button
                    className="ml-2"
                    variant="info"
                    type="button"
                    value="preview"
                    id="preview"
                    onClick={handleSubmit}
                >
                    Preview
                </Button>
            </Stack>
        </div>
    );
}

export default ActiveCodeCreator;
