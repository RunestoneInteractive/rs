import "./App.css";
import AssignmentEditor, { AssignmentPicker, AssignmentQuestion } from "./renderers/assignment.jsx";
import ActiveCodeCreator from "./renderers/activeCode.jsx";
import Preview from "./renderers/preview.jsx";

function App() {
    return (
        <>
            <AssignmentPicker />
            <AssignmentEditor />
            <AssignmentQuestion />
            <ActiveCodeCreator />
            <Preview />
            <div id="editRST"> </div>
        </>
    );
}

export default App;
