import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { createMCQTemplate } from "../componentFuncs";
import { setCode } from "../state/preview/previewSlice";

export function MultipleChoiceCreator() {

    const [optionList, setOptionList] = React.useState([{ choice: "", feedback: "", correct: false }]);
    const [statement, setStatement] = React.useState("");
    const dispatch = useDispatch();

    const handleAddOption = () => {
        setOptionList([...optionList, { choice: "", feedback: "", correct: false }]);
    }

    const handleNewChoice = (index, event) => {
        const values = [...optionList];
        values[index].choice = event.target.value;
        setOptionList(values);
        dispatch(setCode(createMCQTemplate("test", statement, optionList)));
    }

    const handleNewFeedback = (index, event) => {
        const values = [...optionList];
        values[index].feedback = event.target.value;
        setOptionList(values);
        dispatch(setCode(createMCQTemplate("test", statement, optionList)));
    }

    const handleDeleteOption = (index) => {
        const values = [...optionList];
        values.splice(index, 1);
        setOptionList(values);
        dispatch(setCode(createMCQTemplate("test", statement, optionList)));
    }

    const markCorrect = (index) => {
        const values = [...optionList];
        values[index].correct = !values[index].correct;
        setOptionList(values);
    }

    return (
        <div>
            <h1>Multiple Choice</h1>
            <div className="p-fluid p-field">
                <label htmlFor="mcStatement">Question Prompt</label>
                <InputTextarea id="mcStatement"
                    placeholder="Question"
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                />
            </div>
            <br />
            <label>Choices</label>
            <hr />
            {optionList.map((option, index) => (
                <>
                <div key={index} className="p-fluid">
                    <label>Choice {index + 1}</label>
                    <InputTextarea value={option.choice} placeholder="text or html ok" onChange={(e) => handleNewChoice(index, e)} />
                </div>
                <div className="flex flex-wrap justify-content-left gap-3 mb-4">
                    <label>Feedback {index + 1}</label>
                    <InputTextarea value={option.feedback} onChange={(e) => handleNewFeedback(index, e)} />
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
