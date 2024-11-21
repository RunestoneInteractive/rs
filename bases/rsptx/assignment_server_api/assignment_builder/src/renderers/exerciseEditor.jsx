import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { Panel } from "primereact/panel";
import PropTypes from "prop-types";
import { Toaster } from "react-hot-toast";
import { useSelector, useDispatch } from "react-redux";

import { selectAll as selectAssignAll } from "../state/assignment/assignSlice";
import { sumPoints } from "../state/assignment/assignSlice";
import {
  setQpoints,
  selectUniqueId,
  selectQpoints,
  setUniqueId,
  setAuthor,
  setTags,
  setDifficulty,
  setTopic,
  selectAuthor,
  selectTags,
  selectDifficulty,
  selectTopic,
} from "../state/interactive/interactiveSlice";
import { saveAssignmentQuestion } from "../state/interactive/interactiveSlice";

import { ChapterSelector } from "./chapterSelector.jsx";

const acStyle = {
  border: "1px solid black",
  padding: "10px",
};
/**
 *
 * @returns The ActiveCodeCreator component
 * @description This component is a container for the common parts of an assignment question.
 * @namespace ActiveCodeEditor
 *
 */

export function ExerciseEditor(props) {
  // use these selectors to get the values from the store (slice for activecode)
  const uniqueId = useSelector(selectUniqueId);
  const qpoints = useSelector(selectQpoints);
  const difficulty = useSelector(selectDifficulty);
  const topic = useSelector(selectTopic);
  const author = useSelector(selectAuthor);
  const tags = useSelector(selectTags);
  const dispatch = useDispatch();
  const assignData = useSelector(selectAssignAll);

  const buttonTitle = props.editonly ? "Save Changes" : "Save and Add";

  return (
    <div style={acStyle}>
      <Toaster />
      <div className="contain2col">
        <div className="item">
          <label htmlFor="qpoints">Points</label>
          <InputNumber
            id="qpoints"
            placeholder="Points"
            value={qpoints}
            onChange={(e) => {
              dispatch(setQpoints(e.value));
              dispatch(sumPoints());
            }}
          />
        </div>
      </div>
      <div>
        <label htmlFor="uniqueId">Question Name</label>
        <InputText
          id="uniqueId"
          placeholder="Enter Question Name"
          value={uniqueId}
          onChange={(e) => dispatch(setUniqueId(e.target.value))}
        />
        <label htmlFor="chapSelect">Chapter</label>
        <ChapterSelector />

        {props.component}

        <Panel header="More Options" collapsed={true} toggleable>
          <div className="formgrid grid">
            <div className="field col">
              <label htmlFor="author">Author</label>
              <InputText
                id="author"
                value={author}
                placeholder="Author"
                onChange={(e) => dispatch(setAuthor(e.target.value))}
              />
            </div>
            <div className="field col">
              <label htmlFor="tags">Tags</label>
              <InputText
                id="tags"
                value={tags}
                placeholder="Tags"
                className="field"
                onChange={(e) => dispatch(setTags(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="difficulty">Difficulty</label>
              <InputNumber
                id="difficulty"
                value={difficulty}
                placeholder="Difficulty"
                className="field"
                onChange={(e) => dispatch(setDifficulty(e.target.value))}
              />
            </div>
            <div className="field col">
              <label htmlFor="topic">Topic</label>
              <InputText
                id="topic"
                value={topic}
                placeholder="Topic"
                className="field"
                onChange={(e) => dispatch(setTopic(e.target.value))}
              />
            </div>
          </div>
        </Panel>
      </div>
      <Button
        value="save"
        onClick={() =>
          //Should update preview_src first
          dispatch(
            saveAssignmentQuestion({
              assignData: assignData,
              editonly: props.editonly,
            }),
          )
        }
      >
        {buttonTitle}
      </Button>
    </div>
  );
}

ExerciseEditor.propTypes = {
  component: PropTypes.element.isRequired,
  editonly: PropTypes.bool,
};

ExerciseEditor.defaultProps = {
  editonly: false,
};

export default ExerciseEditor;
