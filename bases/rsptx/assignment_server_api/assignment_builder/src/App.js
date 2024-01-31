import "./App.css";
import { useState } from "react";
import { renderRunestoneComponent } from "./componentFuncs.js";

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
        if (e.target.value === "preview") {
        document.getElementById("preview_div").innerHTML = preview_src;
        renderRunestoneComponent(preview_src, "preview_div", {});
        }
    };
    const handleSave = (e) => {
        e.preventDefault();
    };

    // This is the html template for an activecode component.  It is the same as what is generated
    // by the RST or the PreTeXt.
    var preview_src = `
<div class="ptx-runestone-container">
<div class="runestone explainer ac_section ">
<div data-component="activecode" id=code4_2_4 data-question_label="4.2.2.2">
<div id=code4_2_4_question class="ac_question">
<p>${assignData.instructions}</p>

</div>
<textarea data-lang="${assignData.language}" id="${assignData.name}"
    data-timelimit=25000  data-codelens="true"
    data-audio=''
    data-wasm=/_static
    >
${assignData.prefix_code}
^^^^
${assignData.starter_code}
====
${assignData.suffix_code}

</textarea>
</div>
</div>
</div>
    `;
    return (
        <div className="App">
            <h1>ActiveCode Builder</h1>
            <div className="ac_details">
                <form>
                    <label htmlFor="name">Assignment Name</label>
                    <input
                        id="name"
                        className="rsform"
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
                        className="rsform"
                        type="text"
                        placeholder="Enter Assignment Description"
                        value={assignData.desc}
                        onChange={handleChange}
                    />
                    <br />
                    <label htmlFor="due">Assignment Due Date</label>
                    <input
                        id="due"
                        className="rsform"
                        type="datetime-local"
                        placeholder="Enter Assignment Due Date"
                        value={assignData.due}
                        onChange={handleChange}
                    />
                    <br />
                    <label htmlFor="points">Assignment Points</label>
                    <input
                        id="points"
                        className="rsform"
                        type="number"
                        placeholder="Enter Points"
                        value={assignData.points}
                        onChange={handleChange}
                    />
                    <br />
                    <label htmlFor="language">Assignment Language</label>
                    <select id="language" className="rsform">
                        <option value="python">Python (in browser)</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                        <option value="c">C</option>
                        <option value="javascript">Javascript</option>
                        <option value="html">HTML</option>
                    </select>
                    <br />
                    <textarea
                        rows="4"
                        cols="60"
                        id="instructions"
                        className="rsform"
                        placeholder="Enter Assignment Instructions"
                        value={assignData.instructions}
                        onChange={handleChange}
                    ></textarea>
                    <br />
                    <textarea
                        rows="4"
                        cols="60"
                        id="prefix_code"
                        className="rsform"
                        placeholder="Enter Assignment Prefix Code"
                        value={assignData.prefix_code}
                        onChange={handleChange}
                    ></textarea>
                    <br />
                    <textarea
                        rows="4"
                        cols="60"
                        id="starter_code"
                        className="rsform"
                        placeholder="Enter Assignment Starter Code"
                        value={assignData.starter_code}
                        onChange={handleChange}
                    ></textarea>
                    <br />
                    <textarea
                        rows="4"
                        cols="60"
                        id="suffix_code"
                        className="rsform"
                        placeholder="Enter Assignment Suffix Code"
                        value={assignData.suffix_code}
                        onChange={handleChange}
                    ></textarea>
                    <br />
                    <button type="button" value="save" onClick={handleSave}>
                        Save
                    </button>
                    <button type="button" value="preview" id="preview" onClick={handleSubmit}>
                        Preview
                    </button>
                </form>
            </div>
            <div id="preview_div"></div>
            <div id="editRST">  </div>
        </div>
    );
}

export default App;
