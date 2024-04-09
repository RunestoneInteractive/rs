import React from "react";
import "./App.css";
import AssignmentEditor, { MoreOptions, AddQuestionTabGroup } from "./renderers/assignment.jsx";
import { AssignmentQuestion } from "./renderers/assignmentQuestion.jsx";
import Preview from "./renderers/preview.jsx";

function App() {
    return (
        <>
            <h1 className="App">Assignment Builder</h1>
            <AssignmentEditor />
            <MoreOptions />
            <AssignmentQuestion />
            <AddQuestionTabGroup />
            <Preview />
            <div id="editRST"> </div>
        </>
    );
}

export default App;
