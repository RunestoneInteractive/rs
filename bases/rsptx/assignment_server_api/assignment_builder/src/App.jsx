import "./App.css";
import AssignmentEditor, { AssignmentPicker, AssignmentQuestion, MoreOptions, AddQuestionTabGroup } from "./renderers/assignment.jsx";
import ActiveCodeCreator from "./renderers/activeCode.jsx";
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
