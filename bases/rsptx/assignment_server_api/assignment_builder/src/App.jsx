import React from "react";
import "./App.css";
import AssignmentEditor, { MoreOptions, AddQuestionTabGroup } from "./renderers/assignment.jsx";
import { AssignmentQuestion, problemColumnSpec, problemColumns, readingColumnSpec, readingColumns } from "./renderers/assignmentQuestion.jsx";
import Preview from "./renderers/preview.jsx";
import { useSelector } from "react-redux";
import { selectIsAuthorized } from "./state/assignment/assignSlice.js";
import { useSearchParams } from "react-router-dom";

function App() {
    // todo: save this for once routing is implemented
    //const [searchParams, setSearchParams] = useSearchParams();
    //let assignmentId = searchParams.get("assignment_id");
    //console.log("assignmentId: ", assignmentId);

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
            <h1 className="App">Assignment Builder</h1>
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
            <Preview />
            <div id="editRST"> </div>
        </>
    );
}

export default App;
