import "./App.css";
import { useState } from "react";

function App() {
    const [assignData, setAsignData] = useState({
        name: "",
        desc: "",
        due: "",
        points: "",
        instructions: "",
        prefix_code: "",
        starter_code: "",
        suffix_code: "",
    });

    const handleChange = (e) => {
        setAsignData((prevData) => ({
            ...prevData,
            [e.target.id]: e.target.value,
        }));
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        console.log(assignData);
        // todo: send data to server
        // handle a preview button
    };
    return (
        <div className="App">
            <h1>Assignment Builder</h1>
            <div className="ac_details">
                <form onSubmit={handleSubmit}>
                    <label htmlFor="name">Assignment Name</label>
                    <input
                        id="name"
                        class="rsform"
                        type="text"
                        placeholder="Enter Assignment Name"
                        value={assignData.name}
                        onChange={handleChange}
                    />
                    <br />
                    <label htmlFor="desc">Assignment Description</label>
                    <input
                        size="50"
                        id="desc"
                        class="rsform"
                        type="text"
                        placeholder="Enter Assignment Description"
                        value={assignData.desc}
                        onChange={handleChange}
                    />
                    <br />
                    <label htmlFor="due">Assignment Due Date</label>
                    <input
                        id="due"
                        class="rsform"
                        type="datetime-local"
                        placeholder="Enter Assignment Due Date"
                        value={assignData.due}
                        onChange={handleChange}
                    />
                    <br />
                    <label htmlFor="points">Assignment Points</label>
                    <input
                        id="points"
                        class="rsform"
                        type="number"
                        placeholder="Enter Points"
                        value={assignData.points}
                        onChange={handleChange}
                    />
                    <br />
                    <label htmlFor="language">Assignment Language</label>
                    <select id="language" class="rsform">
                        <option value="python">Python (in browser)</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                        <option value="c">C</option>
                        <option value="javascript">Javascript</option>
                        <option value="html">HTML</option>
                    </select>
                    <textarea
                        rows="4"
                        cols="60"
                        id="instructions"
                        class="rsform"
                        placeholder="Enter Assignment Instructions"
                        value={assignData.instructions}
                        onChange={handleChange}
                    ></textarea>
                    <br />
                    <textarea
                        rows="4"
                        cols="60"
                        id="prefix_code"
                        class="rsform"
                        placeholder="Enter Assignment Prefix Code"
                        value={assignData.prefix_code}
                        onChange={handleChange}
                    ></textarea>
                    <br />
                    <textarea
                        rows="4"
                        cols="60"
                        id="starter_code"
                        class="rsform"
                        placeholder="Enter Assignment Starter Code"
                        value={assignData.starter_code}
                        onChange={handleChange}
                    ></textarea>
                    <br />
                    <textarea
                        rows="4"
                        cols="60"
                        id="suffix_code"
                        class="rsform"
                        placeholder="Enter Assignment Suffix Code"
                        value={assignData.suffix_code}
                        onChange={handleChange}
                    ></textarea>
                    <br />
                    <button type="submit" value="save">
                        Save
                    </button>
                    <button type="submit" value="preview" id="preview">
                        Preview
                    </button>
                </form>
            </div>
            <div id="preview"></div>
        </div>
    );
}

export default App;
