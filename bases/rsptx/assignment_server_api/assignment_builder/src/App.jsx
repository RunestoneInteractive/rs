import "./App.css";
import Assignment from "./renderers/assignment.jsx";
import ActiveCodeCreator from "./renderers/activeCode.jsx";
import { useSelector, useDispatch } from "react-redux";


function App() {

    return (
        <>
            <Assignment />
            <ActiveCodeCreator />
            <div className="App" id="preview_div"></div>
            <div id="editRST"> </div>
        </>
    );
}

export default App;
