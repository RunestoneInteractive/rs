import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Stack from "react-bootstrap/Stack";
import { useState } from "react";

const ActiveCode = ({ acData, handleAcDataChange }) => {
    return (
        <div>
            <Form.Group className="mb-1" as={Row}>
            <Form.Label column sm={2}>
                Language
            </Form.Label>
            <Col sm={4}>
                <Form.Select
                    id="language"
                    className="rsform"
                    value={acData.language}
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
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Control
                    as="textarea"
                    rows={3}
                    cols={60}
                    id="instructions"
                    className="rsform"
                    placeholder="Enter Assignment Instructions (HTML Allowed)"
                    value={acData.instructions}
                    onChange={handleAcDataChange}
                ></Form.Control>
                <Form.Control
                    as="textarea"
                    rows="4"
                    cols="60"
                    id="prefix_code"
                    className="rsform"
                    placeholder="Enter Assignment Prefix Code"
                    value={acData.prefix_code}
                    onChange={handleAcDataChange}
                ></Form.Control>
                <Form.Control
                    as="textarea"
                    rows="4"
                    cols="60"
                    id="starter_code"
                    className="rsform"
                    placeholder="Enter Assignment Starter Code"
                    value={acData.starter_code}
                    onChange={handleAcDataChange}
                ></Form.Control>
                <Form.Control
                    as="textarea"
                    rows="4"
                    cols="60"
                    id="suffix_code"
                    className="rsform"
                    placeholder="Enter Assignment Suffix (unit test) Code"
                    value={acData.suffix_code}
                    onChange={handleAcDataChange}
                ></Form.Control>
            </Form.Group>
        </div>
    );
};

export default ActiveCode;