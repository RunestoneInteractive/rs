import "./App.css";
import { useState } from "react";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import ActiveCodeCreator from "./activeCode.jsx";

function App() {
    // make the default deadline 7 days from now
    let cDate = new Date();
    let epoch = cDate.getTime();
    epoch = epoch + 60 * 60 * 24 * 7 * 1000;
    cDate = new Date(epoch);
    let defaultDeadline = `${cDate.getFullYear()}-${`${
        cDate.getMonth() + 1
    }`.padStart(2, 0)}-${`${cDate.getDate()}`.padStart(
        2,
        0
    )}T${`${cDate.getHours()}`.padStart(
        2,
        0
    )}:${`${cDate.getMinutes()}`.padStart(2, 0)}`;

    const [assignData, setAsgmtData] = useState({
        name: "",
        desc: "",
        due: defaultDeadline,
        points: 1,
        exercises: [],
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

    const handleNewExercise = (eData) => {
        setAsgmtData((prevData) => {
            let newd = {
                ...prevData,
            };
            newd.exercises = newd.exercises.filter(
                (ex) => ex.uniqueId !== eData.uniqueId
            );
            newd.exercises.push(eData);
            newd.points = parseInt(
                newd.exercises.reduce(
                    (acc, ex) => acc + parseInt(ex.qpoints),
                    0
                )
            );
            return newd;
        });
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
                    <ActiveCodeCreator
                        assignData={assignData}
                        newExercise={handleNewExercise}
                    />
                </Form>
            </div>
            <div id="preview_div"></div>
            <div id="editRST"> </div>
        </div>
    );
}

export default App;
