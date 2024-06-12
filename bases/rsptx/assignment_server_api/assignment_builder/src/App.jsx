import React from "react";
import "./App.css";
import AssignmentEditor, { MoreOptions, AddQuestionTabGroup } from "./renderers/assignment.jsx";
import { AssignmentQuestion, problemColumnSpec, problemColumns, readingColumnSpec, readingColumns } from "./renderers/assignmentQuestion.jsx";
import { useSelector } from "react-redux";
import { selectIsAuthorized } from "./state/assignment/assignSlice.js";
import { BrowserRouter, useSearchParams } from "react-router-dom";
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AssignmentPicker } from "./renderers/assignmentPicker.jsx";
import { AssignmentSummary } from "./renderers/assignmentSummary.jsx";

function AssignmentBuilder() {
    const [searchParams] = useSearchParams();
    let assignmentId = searchParams.get("assignment_id");
    console.log("assignmentId: ", assignmentId);

    return (
        <>  <div className="App card flex justify-content-center">
            <h1 className="App" style={{ marginBottom: "1rem" }}>Assignment Builder</h1>
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

function AssignmentGrader() {
    return (
        <div className="App">
            <h1>Assignment Grader</h1>
            <AssignmentPicker />
            <AssignmentSummary />
        </div>
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

    /**
     * The main router for the application.
     * HashRouter is not recommended, but seems like the easiest way
     * to get routing to work with the docker setup.  This allows us to
     * load index.html as served by FastAPI static files but access the routes
     * in the app.
     * For example
     * http://localhost:5173/index.html#/grader for the grader or 
     * http://localhost:5173/index.html#/ for the assignment builder. 
     * although http://localhost:5173/index.html also works.
     * If one was to go back to a BrowserRouter then you would need to
     * add back in the basename attribute to the BrowserRouter.
     * basename={import.meta.env.BASE_URL}
     */
    console.log("ENV: ", import.meta.env);
    return (
        <>
            <BrowserRouter basename={import.meta.env.VITE_BASE_URL} >
                <Routes>
                    <Route path="/" element={<AssignmentBuilder />} />
                    <Route path="/builder" element={<AssignmentBuilder />} />
                    <Route path="/grader" element={<AssignmentGrader />} />
                </Routes>
            </BrowserRouter>
        </>
    );
}

export default App;
