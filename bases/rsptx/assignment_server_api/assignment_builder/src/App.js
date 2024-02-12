import "./App.css";
import { useState } from "react";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import ActiveCode from "./activeCode.js";

function App() {
    const [assignData, setAsignData] = useState({
        name: "",
        desc: "",
        due: "",
        points: 1,
    });

    const handleAsgnDataChange = (e) => {
        setAsignData((prevData) => ({
            ...prevData,
            [e.target.id]: e.target.value,
        }));
    };

    // This is the html template for an activecode component.  It is the same as what is generated
    // by the RST or the PreTeXt.
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
                    <ActiveCode assignData={assignData} />
                </Form>
            </div>
            <div id="preview_div"></div>
            <div id="editRST"> </div>
        </div>
    );
}

export default App;
