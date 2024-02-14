import "./App.css";
import { useState } from "react";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import ActiveCodeCreator from "./activeCode.jsx";

function App() {
    
    let datetime = `${new Date().getFullYear()}-${`${
        new Date().getMonth() + 1
    }`.padStart(2, 0)}-${`${new Date().getDate() + 1}`.padStart(
        2,
        0
    )}T${`${new Date().getHours()}`.padStart(
        2,
        0
    )}:${`${new Date().getMinutes()}`.padStart(2, 0)}`;

    const [assignData, setAsgmtData] = useState({
        name: "",
        desc: "",
        due: datetime,
        points: 1,
    });

    // The setAsgmtData function is used to update the state of the assignData object.
    // The notice that the parameter to setAsgmtData is a function that takes the previous
    // state and returns the new state.
    const handleAsgmtDataChange = (e) => {
        setAsgmtData((prevData) => ({
            ...prevData,
            [e.target.id]: e.target.value,
        }));
    };
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
                            onChange={handleAsgmtDataChange}
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
                            onChange={handleAsgmtDataChange}
                        />
                    </Form.Group>
                    <Form.Group className="mb-1" as={Row}>
                        <Form.Label column sm={1}>
                            Due
                        </Form.Label>
                        <Col sm={4}>
                            <Form.Control
                                id="due"
                                className="rsform"
                                type="datetime-local"
                                value={assignData.due}
                                onChange={handleAsgmtDataChange}
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
                                onChange={handleAsgmtDataChange}
                            />
                        </Col>
                    </Form.Group>
                    <ActiveCodeCreator assignData={assignData} />
                </Form>
            </div>
            <div id="preview_div"></div>
            <div id="editRST"> </div>
        </div>
    );
}

export default App;
