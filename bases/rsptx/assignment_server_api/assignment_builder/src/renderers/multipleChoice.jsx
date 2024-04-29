import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { createMCQTemplate } from "../componentFuncs";
import { setCode } from "../state/preview/previewSlice";
import { setPreviewSrc, setQuestionJson } from "../state/interactive/interactiveSlice";
import { selectUniqueId } from "../state/interactive/interactiveSlice";
import { setOptionList, setStatement, addOption, selectOptionList, selectStatement } from "../state/multiplechoice/mcSlice";

export function MultipleChoiceCreator() {

    const optionList = useSelector(selectOptionList);
    const statement = useSelector(selectStatement);
    const uniqueId = useSelector(selectUniqueId);
    const dispatch = useDispatch();

    const handleAddOption = () => {
        dispatch(addOption());
        handleCodeUpdates();
    }

    const handleCodeUpdates = () => {
        let code = createMCQTemplate(uniqueId, statement, optionList);
        dispatch(setCode(code));
        dispatch(setPreviewSrc(code));
        dispatch(setQuestionJson({ statement, optionList }));
    }

    const handleNewChoice = (index, event) => {
        let values = structuredClone(optionList);
        values[index].choice = event.target.value;
        dispatch(setOptionList(values));
        handleCodeUpdates();
    }

    const handleNewFeedback = (index, event) => {
        const values = structuredClone(optionList);
        values[index].feedback = event.target.value;
        dispatch(setOptionList(values));
        handleCodeUpdates();
    }

    const handleDeleteOption = (index) => {
        const values = structuredClone(optionList);
        values.splice(index, 1);
        dispatch(setOptionList(values));
        handleCodeUpdates();
    }

    const markCorrect = (index) => {
        const values = structuredClone(optionList);
        values[index].correct = !values[index].correct;
        dispatch(setOptionList(values));
        handleCodeUpdates();
    }

    return (
        <div>
            <h1>Multiple Choice</h1>
            <div className="p-fluid p-field">
                <label htmlFor="mcStatement">Question Prompt</label>
                <InputTextarea id="mcStatement"
                    placeholder="Question"
                    value={statement}
                    onChange={(e) => dispatch(setStatement(e.target.value))}
                    onBlur={handleCodeUpdates}
                />
            </div>
            <br />
            <label>Choices</label>
            <hr />
            {optionList.map((option, index) => (
                <>
                    <div key={index} className="p-fluid">
                        <label>Choice {index + 1}</label>
                        <InputTextarea value={option.choice} 
                            placeholder="text or html ok" 
                            onChange={(e) => handleNewChoice(index, e)} 
                            onBlur={handleCodeUpdates} />
                    </div>
                    <div className="flex flex-wrap justify-content-left gap-3 mb-4">
                        <label>Feedback {index + 1}</label>
                        <InputTextarea value={option.feedback} 
                            onChange={(e) => handleNewFeedback(index, e)} 
                            onBlur={handleCodeUpdates}/>
                        <label>Correct</label>
                        <Checkbox checked={option.correct} onChange={() => markCorrect(index)} />
                        {optionList.length > 1 && <Button rounded outlined severity="danger" icon="pi pi-trash" onClick={() => handleDeleteOption(index)} />}
                        {index === optionList.length - 1 && <Button rounded outlined severity="success" icon="pi pi-plus" onClick={handleAddOption} />}
                        <hr />
                    </div>
                </>
            ))}
        </div>
    );
}
