import { useSelector, useDispatch } from "react-redux";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

import {
    updateField,
    selectName,
    selectDesc,
    selectDue,
    selectPoints,
    selectExercises,
    selectAll,
} from "../state/assignment/assignSlice";

function Assignment() {
    const dispatch = useDispatch();
    const name = useSelector(selectName);
    const desc = useSelector(selectDesc);
    const due = useSelector(selectDue);
    const points = useSelector(selectPoints);
    const exercises = useSelector(selectExercises);
    const assignData = useSelector(selectAll);

    // The setAsgmtData function is used to update the state of the assignData object.
    // The notice that the parameter to setAsgmtData is a function that takes the previous
    // state and returns the new state.
    const handleAsgmtDataChange = (e) => {
        dispatch(updateField({ field: e.target.id, newVal: e.target.value }));
    };

    return (
        <div className="App">
            <h1>ActiveCode Builder</h1>
            <div className="ac_details">
                <Form.Group className="mb-4">
                    <Form.Label htmlFor="name">Assignment Name</Form.Label>
                    <Form.Control
                        id="name"
                        className="rsform"
                        type="text"
                        placeholder="Enter Assignment Name"
                        value={name}
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
                        value={desc}
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
                            value={due}
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
                            value={points}
                            onChange={handleAsgmtDataChange}
                        />
                    </Col>
                </Form.Group>
            </div>
        </div>
    );
}

export default Assignment;
