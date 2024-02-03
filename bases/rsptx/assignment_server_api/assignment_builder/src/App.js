import "./App.css";
import { useState } from "react";
import { renderRunestoneComponent } from "./componentFuncs.js";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Stack from "react-bootstrap/Stack";

function App() {
    const [assignData, setAsignData] = useState({
        name: "",
        desc: "",
        due: "",
        points: "",
        language: "python",
        instructions: "",
        prefix_code: "",
        starter_code: "",
        suffix_code: "",
    });

    const [acData, setAcData] = useState({
        uniqueId: "",
        language: "python",
    });

    const handleChange = (e) => {
        setAsignData((prevData) => ({
            ...prevData,
            [e.target.id]: e.target.value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log(assignData);
        // todo: send data to server
        // handle a preview button
        console.log(assignData)
        if (e.target.value === "preview") {
            document.getElementById("preview_div").innerHTML = preview_src;
            renderRunestoneComponent(preview_src, "preview_div", {});
        }
    };
    const handleSave = (e) => {
        e.preventDefault();
    };

    // This is the html template for an activecode component.  It is the same as what is generated
    // by the RST or the PreTeXt.
    var preview_src = `
<div class="ptx-runestone-container">
<div class="runestone explainer ac_section ">
<div data-component="activecode" id=code4_2_4 data-question_Form.Label="4.2.2.2">
<div id=code4_2_4_question class="ac_question">
<p>${assignData.instructions}</p>

</div>
<textarea data-lang="${assignData.language}" id="${assignData.name}"
    data-timelimit=25000  data-codelens="true"  style="visibility: hidden;"
    data-audio=''
    data-wasm=/_static
    >
${assignData.prefix_code}
^^^^
${assignData.starter_code}
====
${assignData.suffix_code}

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
                            onChange={handleChange}
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
                            onChange={handleChange}
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
                                onChange={handleChange}
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
                                onChange={handleChange}
                            />
                        </Col>
                        <Form.Label column sm={2}>
                            Language
                        </Form.Label>
                        <Col sm={2}>
                            <Form.Select
                                id="language"
                                className="rsform"
                                value={assignData.language}
                                onChange={handleChange}
                            >
                                <option value="python">
                                    Python (in browser)
                                </option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                                <option value="c">C</option>
                                <option value="javascript">Javascript</option>
                                <option value="html">HTML</option>
                                <option value="sql">SQL</option>
                            </Form.Select>
                        </Col>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <br />
                        <Form.Control
                            as="textarea"
                            rows={3}
                            cols={60}
                            id="instructions"
                            className="rsform"
                            placeholder="Enter Assignment Instructions (HTML Allowed)"
                            value={assignData.instructions}
                            onChange={handleChange}
                        ></Form.Control>
                        <Form.Control
                            as="textarea"
                            rows="4"
                            cols="60"
                            id="prefix_code"
                            className="rsform"
                            placeholder="Enter Assignment Prefix Code"
                            value={assignData.prefix_code}
                            onChange={handleChange}
                        ></Form.Control>
                        <Form.Control
                            as="textarea"
                            rows="4"
                            cols="60"
                            id="starter_code"
                            className="rsform"
                            placeholder="Enter Assignment Starter Code"
                            value={assignData.starter_code}
                            onChange={handleChange}
                        ></Form.Control>
                        <Form.Control
                            as="textarea"
                            rows="4"
                            cols="60"
                            id="suffix_code"
                            className="rsform"
                            placeholder="Enter Assignment Suffix (unit test) Code"
                            value={assignData.suffix_code}
                            onChange={handleChange}
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
                </Form>
            </div>
            <div id="preview_div"></div>
            <div id="editRST"> </div>
        </div>
    );
}

export default App;
