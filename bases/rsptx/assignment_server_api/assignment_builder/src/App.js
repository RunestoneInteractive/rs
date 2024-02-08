import "./App.css";
import { useState } from "react";
import { renderRunestoneComponent } from "./componentFuncs.js";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Stack from "react-bootstrap/Stack";
import ActiveCode
 from "./activeCode.js";
function App() {
    const [assignData, setAsignData] = useState({
        name: "",
        desc: "",
        due: "",
        points: "",
    });

    const [acData, setAcData] = useState({
        uniqueId: "",
        language: "python",
        instructions: "",
        prefix_code: "",
        starter_code: "",
        suffix_code: "",
    });

    const handleAsgnDataChange = (e) => {
        setAsignData((prevData) => ({
            ...prevData,
            [e.target.id]: e.target.value,
        }));
    };

    const handleAcDataChange = (e) => {
        setAcData((prevData) => ({
            ...prevData,
            [e.target.id]: e.target.value,
        }));
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        // handle a preview button
        console.log(assignData);
        if (e.target.value === "preview") {
            document.getElementById("preview_div").innerHTML = preview_src;
            renderRunestoneComponent(preview_src, "preview_div", {});
        }
    };
    const handleSave = async (e) => {
        e.preventDefault();
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
            name: assignData.name,
            question: acData,
            question_type: "activecode",
            source: JSON.stringify(assignData),
            htmlsrc: preview_src,
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

    // This is the html template for an activecode component.  It is the same as what is generated
    // by the RST or the PreTeXt.
    var preview_src = `
<div class="ptx-runestone-container">
<div class="runestone explainer ac_section ">
<div data-component="activecode" id=code4_2_4 data-question_Form.Label="4.2.2.2">
<div id=code4_2_4_question class="ac_question">
<p>${acData.instructions}</p>

</div>
<textarea data-lang="${acData.language}" id="${assignData.name}"
    data-timelimit=25000  data-codelens="true"  style="visibility: hidden;"
    data-audio=''
    data-wasm=/_static
    >
${acData.prefix_code}
^^^^
${acData.starter_code}
====
${acData.suffix_code}

</textarea>
</div>
</div>
</div>
    `;
    return (
        <div className="App">
            <h1>ActiveCode Builder</h1>
            <div className="ac_details">
                <Form>
                    <Form.Group className="mb-4">
                        <Form.Label htmlFor="name">Assignment Name</Form.Label>
                        <Form.Control
                            id="name"
                            className="rsform"
                            type="text"
                            placeholder="Enter Assignment Name"
                            value={assignData.name}
                            onChange={handleAsgnDataChange}
                        />
                        <Form.Label htmlFor="desc">
                            Assignment Description
                        </Form.Label>
                        <Form.Control
                            size="50"
                            id="desc"
                            className="rsform"
                            type="text"
                            placeholder="Enter Assignment Description"
                            value={assignData.desc}
                            onChange={handleAsgnDataChange}
                        />
                    </Form.Group>
                    <Form.Group className="mb-1" as={Row}>
                        <Form.Label column sm={1}>
                            Due
                        </Form.Label>
                        <Col sm={3}>
                            <Form.Control
                                id="due"
                                className="rsform"
                                type="datetime-local"
                                placeholder="Enter Assignment Due Date"
                                value={assignData.due}
                                onChange={handleAsgnDataChange}
                            />
                        </Col>
                        <Form.Label column sm={2}>
                            Total Points
                        </Form.Label>
                        <Col sm={2}>
                            <Form.Control
                                id="points"
                                className="rsform"
                                type="number"
                                placeholder="Points"
                                value={assignData.points}
                                onChange={handleAsgnDataChange}
                            />
                        </Col>
                    </Form.Group>
                    <ActiveCode acData={acData} handleAcDataChange={handleAcDataChange} />
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
                </Form>
            </div>
            <div id="preview_div"></div>
            <div id="editRST"> </div>
        </div>
    );
}

export default App;
