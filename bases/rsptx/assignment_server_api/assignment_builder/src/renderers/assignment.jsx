import { useSelector, useDispatch } from "react-redux";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Dropdown from "react-bootstrap/Dropdown";

import {
    updateField,
    selectName,
    selectDesc,
    selectDue,
    selectPoints,
    selectExercises,
    selectAll,
} from "../state/assignment/assignSlice";

function AssignmentEditor() {
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

const optionStyle = {
    marginLeft: "10px",
    float: "right",
    fontFamily: "mono",
};

export function AssignmentPicker() {
    const dispatch = useDispatch();
    const assignData = useSelector(selectAll);

    const handleAssignmentChange = (e) => {
        dispatch(setAssignment(e.target.value));
    };

    const sortFunc = (a, b) => {
        return a.duedate.localeCompare(b.duedate);
    };

    const all_assignments = useSelector(selectAll).all_assignments;
    let sorted_assignments = structuredClone(all_assignments).sort(sortFunc).reverse();
    sorted_assignments = sorted_assignments.filter((a) => a.name !== "");
    const menuStyle = {
        maxHeight: "200px",
        overflowY: "auto",
    };
    return (
        <div className="App">
            <h1>Assignment Builder</h1>
            <Dropdown
                onSelect={(e) => {
                    console.log("Hello");
                    console.log(e);
                }}
            >
                <Dropdown.Toggle variant="info" id="dropdown-basic">
                    Choose Assignment
                </Dropdown.Toggle>
                <Dropdown.Menu style={menuStyle}>
                    {sorted_assignments.map((a) => (
                        <Dropdown.Item eventKey={a.id}>
                            <span>
                                <strong>{a.name}</strong>
                            </span>
                            <span style={optionStyle}>{a.duedate}</span>
                        </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown>
        </div>
    );
}
export default AssignmentEditor;
