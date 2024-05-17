import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Dropdown } from "primereact/dropdown";
import { setComponent, selectComponent, selectComponentOptions } from "../state/componentEditor/editorSlice";
import { setQuestionType } from "../state/interactive/interactiveSlice";
import ActiveCodeCreator from "./activeCode";
import { MultipleChoiceCreator } from "./multipleChoice";
import { ShortAnswerCreator } from "./shortAnswer";
import { ExerciseEditor } from "./exerciseEditor";
import PropTypes from 'prop-types';
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
    "activecode": ActiveCodeCreator,
    "multiplechoice": MultipleChoiceCreator,
    "shortanswer": ShortAnswerCreator,
}

/**
 * This component is a container to compose an editing interface for the selected component.
 * @returns The InteractiveComponent component
 */
export function EditorContainer({ componentName }) {
    const selectedComponent = useSelector(selectComponent);
    let componentChoice = componentName || selectedComponent;

    if (!componentChoice) {
        return null;
    }
    switch (componentChoice) {
        case "activecode":
            return <ExerciseEditor component={<ActiveCodeCreator />} />;
        case "multiplechoice":
        case "mchoice":
            return <ExerciseEditor component={<MultipleChoiceCreator />} />;
        case "shortanswer":
            return <ExerciseEditor component={<ShortAnswerCreator />} />;
        default:
            return (
                <p>We have not built an editor for this question type yet.</p>
            );
    }

}

EditorContainer.propTypes = {
    componentName: PropTypes.string,
};
EditorContainer.defaultProps = {
    componentName: null,
};