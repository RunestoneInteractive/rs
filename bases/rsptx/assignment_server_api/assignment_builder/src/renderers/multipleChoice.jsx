import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";

export function MultipleChoiceCreator() {

    const [optionList, setOptionList] = React.useState([{choice: "", correct: false}]);

    const handleAddOption = () => {
        setOptionList([...optionList, {choice: "", correct: false}]);
    }

    const handleChange = (index, event) => {
        const values = [...optionList];
        values[index].choice = event.target.value;
        setOptionList(values);
    }

    return (
        <div>
            <h1>Multiple Choice</h1>
            <InputText placeholder="Question" />
                {optionList.map((option, index) => (
                    <div key={index}>
                        <InputText value={option.choice} onChange={(e) => handleChange(index, e)} />
                        <Button label="Correct" />
                        {index === optionList.length - 1 && <Button label="Add Option" onClick={handleAddOption} />}
                    </div>
                ))}
        </div>
    );
}
