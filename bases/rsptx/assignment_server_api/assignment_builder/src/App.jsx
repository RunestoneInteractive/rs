import "./App.css";
import Assignment from "./renderers/assignment.jsx";
import ActiveCodeCreator from "./renderers/activeCode.jsx";
import Preview from "./renderers/preview.jsx";

function App() {
    return (
        <>
            <Assignment />
            <ActiveCodeCreator />
            <Preview />
            <div id="editRST"> </div>
        </>
    );
}

export default App;
