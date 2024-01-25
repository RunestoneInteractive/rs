import "./App.css";

function App() {
    return (
        <div className="App">
            <h1>Assignment Builder</h1>
            <div className="ac_details">
                <input
                    id="name"
                    type="text"
                    placeholder="Enter Assignment Name"
                />
                <br />
                <input
                    size="50"
                    id="desc"
                    type="text"
                    placeholder="Enter Assignment Description"
                />
                <br />
                <input
                    id="due"
                    type="datetime-local"
                    placeholder="Enter Assignment Due Date"
                />
                <br />
                <input
                    id="points"
                    type="number"
                    placeholder="Enter Assignment Points"
                />
                <br />
                <textarea
                    rows="4"
                    cols="60"
                    id="instructions"
                    placeholder="Enter Assignment Instructions"
                ></textarea>
                <br />
                <textarea
                    rows="4"
                    cols="60"
                    id="prefix_code"
                    placeholder="Enter Assignment Prefix Code"
                ></textarea>
                <br />
                <textarea
                    rows="4"
                    cols="60"
                    id="starter_code"
                    placeholder="Enter Assignment Starter Code"
                ></textarea>
                <br />
                <textarea
                    rows="4"
                    cols="60"
                    id="suffix_code"
                    placeholder="Enter Assignment Suffix Code"
                ></textarea>
            </div>
            <div className="ac_buttons">
                <button id="save">Save</button>
                <button id="preview">Preview</button>
            </div>
        </div>
    );
}

export default App;
