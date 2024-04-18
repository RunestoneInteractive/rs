import React from "react";
import "./App.css";
import AssignmentEditor, { MoreOptions, AddQuestionTabGroup } from "./renderers/assignment.jsx";
import { AssignmentQuestion, problemColumnSpec, problemColumns, readingColumnSpec, readingColumns } from "./renderers/assignmentQuestion.jsx";
import { useSelector } from "react-redux";
import { selectIsAuthorized } from "./state/assignment/assignSlice.js";
import { useSearchParams } from "react-router-dom";
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function AssignmentBuilder() {
    const [searchParams] = useSearchParams();
    let assignmentId = searchParams.get("assignment_id");
    console.log("assignmentId: ", assignmentId);

    return (
        <>  <div className="App card flex justify-content-center">
            <h1 className="App" style={{marginBottom: "1rem"}}>Assignment Builder</h1>
            </div>
            <AssignmentEditor />
            <MoreOptions />
            <AssignmentQuestion
                headerTitle="Sections to Read"
                columns={readingColumns}
                columnSpecs={readingColumnSpec}
                isReading={true}
            />
            <AssignmentQuestion
                headerTitle="Graded Exercises"
                columns={problemColumns}
                columnSpecs={problemColumnSpec}
            />
            <AddQuestionTabGroup />
            
        </>

    )
}
function App() {

    if (useSelector(selectIsAuthorized) === false) {
        return (
            <div>
                <h1 className="App">Assignment Builder</h1>
                <h2>Error fetching assignments, you may not be authorized.</h2>
            </div>
        )
    }

    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<AssignmentBuilder />} />
                </Routes>
            </BrowserRouter>
        </>
    );
}

export default App;
