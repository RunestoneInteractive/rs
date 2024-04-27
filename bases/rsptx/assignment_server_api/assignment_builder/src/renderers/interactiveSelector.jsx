import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Dropdown } from "primereact/dropdown";
import { setComponent, selectComponent, selectComponentOptions } from "../state/componentEditor/editorSlice";
import { setQuestionType } from "../state/interactive/interactiveSlice";
import ActiveCodeCreator from "./activeCode";
import { MultipleChoiceCreator } from "./multipleChoice";
import { ShortAnswerCreator } from "./shortAnswer";
import { ComponentCreator } from "./componentCreator";

/**
 * Choose the kind of exercise to create.
 * @returns The InteractiveSelector component
 */
export function InteractiveSelector() {
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

const kindMap = {
    "activecode": ActiveCodeCreator,
    "multiplechoice": MultipleChoiceCreator,
    "shortanswer": ShortAnswerCreator,
};

/**
 * This component is a container to compose an editing interface for the selected component.
 * @returns The InteractiveComponent component
 */
export function InteractiveComponent() {
    const selectedComponent = useSelector(selectComponent);

    switch(selectedComponent) {
        case "activecode":
            return <ComponentCreator component={<ActiveCodeCreator />} />;
        case "multiplechoice":
            return <ComponentCreator component={<MultipleChoiceCreator />} />;
        case "shortanswer":
            return <ShortAnswerCreator />;
        default:
            return null;
    }
    
}