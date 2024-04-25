import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Dropdown } from "primereact/dropdown";
import { setComponent, selectComponent, selectComponentOptions } from "../state/componentEditor/editorSlice";
import ActiveCodeCreator from "./activeCode";
import { MultipleChoiceCreator } from "./multipleChoice";
import { ShortAnswerCreator } from "./shortAnswer";

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
            }}
            placeholder="What kind of Exercise?"
        />
    );
}


export function InteractiveComponent() {
    const selectedComponent = useSelector(selectComponent);

    // convert the code below to a switch statement
    switch(selectedComponent) {
        case "activecode":
            return <ActiveCodeCreator />;
        case "multiplechoice":
            return <MultipleChoiceCreator />;
        case "shortanswer":
            return <ShortAnswerCreator />;
        default:
            return null;
    }
    
}