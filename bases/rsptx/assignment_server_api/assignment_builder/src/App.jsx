import "./App.css";
import AssignmentEditor, { AssignmentPicker } from "./renderers/assignment.jsx";
import ActiveCodeCreator from "./renderers/activeCode.jsx";
import Preview from "./renderers/preview.jsx";

function App() {
    return (
        <>
            <AssignmentPicker />
            <AssignmentEditor />
            <ActiveCodeCreator />
            <Preview />
            <div id="editRST"> </div>
        </>
    );
}

export default App;
