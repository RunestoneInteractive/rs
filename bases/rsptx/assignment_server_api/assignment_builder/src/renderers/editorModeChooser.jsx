import { Dropdown } from "primereact/dropdown";
import PropTypes from "prop-types";
import { useSelector, useDispatch } from "react-redux";

import {
  setComponent,
  selectComponent,
  selectComponentOptions,
} from "../state/componentEditor/editorSlice";
import { setQuestionType } from "../state/interactive/interactiveSlice";

import ActiveCodeCreator from "./activeCode";
import { ExerciseEditor } from "./exerciseEditor";
import { MultipleChoiceCreator } from "./multipleChoice";
import { ShortAnswerCreator } from "./shortAnswer";
/**
 * Choose the kind of exercise to create.
 * @returns The InteractiveSelector component
 */
export function EditorChooser() {
  const componentOptions = useSelector(selectComponentOptions);
  const dispatch = useDispatch();

  const selectedComponent = useSelector(selectComponent);

  return (
    <Dropdown
      options={componentOptions}
      value={selectedComponent}
      optionLabel="title"
      onChange={(e) => {
        dispatch(setComponent(e.value));
        dispatch(setQuestionType(e.value));
      }}
      placeholder="What kind of Exercise?"
    />
  );
}

export const kindMap = {
  activecode: ActiveCodeCreator,
  multiplechoice: MultipleChoiceCreator,
  shortanswer: ShortAnswerCreator,
};

/**
 * This component is a container to compose an editing interface for the selected component.
 * @returns The InteractiveComponent component
 */
export function EditorContainer(props) {
  const selectedComponent = useSelector(selectComponent);
  let componentChoice = props.componentName || selectedComponent;

  if (!componentChoice) {
    return null;
  }
  switch (componentChoice) {
    case "activecode":
      return <ExerciseEditor component={<ActiveCodeCreator />} editonly={props.editonly} />;
    case "multiplechoice":
    case "mchoice":
      return <ExerciseEditor component={<MultipleChoiceCreator />} editonly={props.editonly} />;
    case "shortanswer":
      return <ExerciseEditor component={<ShortAnswerCreator />} editonly={props.editonly} />;
    default:
      return <p>We have not built an editor for this question type yet.</p>;
  }
}

EditorContainer.propTypes = {
  componentName: PropTypes.string,
  editonly: PropTypes.bool,
};
EditorContainer.defaultProps = {
  componentName: null,
  editonly: false,
};
