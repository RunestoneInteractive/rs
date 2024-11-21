import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { InputTextarea } from "primereact/inputtextarea";
import Prism from "prismjs"; // eslint-disable-line no-unused-vars
import { useSelector, useDispatch } from "react-redux";

import { createMCQTemplate } from "../componentFuncs";
import { setPreviewSrc, setQuestionJson } from "../state/interactive/interactiveSlice";
import { selectUniqueId } from "../state/interactive/interactiveSlice";
import {
  setOptionList,
  setStatement,
  addOption,
  selectOptionList,
  selectStatement,
} from "../state/multiplechoice/mcSlice";
import { setCode } from "../state/preview/previewSlice";

import "prismjs/themes/prism.css";
import "prismjs/plugins/line-numbers/prism-line-numbers.js";
import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-java";

export function MultipleChoiceCreator() {
  const optionList = useSelector(selectOptionList);
  const statement = useSelector(selectStatement);
  const uniqueId = useSelector(selectUniqueId);
  const dispatch = useDispatch();

  const handleAddOption = () => {
    dispatch(addOption());
    handleCodeUpdates();
  };

  // TODO: when called this function normally gets an event as the first parameter.
  // be consistent so we can properly detect the newOptList parameter
  const handleCodeUpdates = (newOptList) => {
    let code = createMCQTemplate(uniqueId, statement, optionList);

    dispatch(setCode(code));
    dispatch(setPreviewSrc(code));
    if (newOptList && newOptList.length > 0) {
      dispatch(setQuestionJson({ statement, optionList: newOptList }));
    } else {
      dispatch(setQuestionJson({ statement, optionList }));
    }
  };

  const handleNewChoice = (index, event) => {
    let values = structuredClone(optionList);

    values[index].choice = event.target.value;
    dispatch(setOptionList(values));
    handleCodeUpdates();
  };

  const handleNewFeedback = (index, event) => {
    const values = structuredClone(optionList);

    values[index].feedback = event.target.value;
    dispatch(setOptionList(values));
    handleCodeUpdates();
  };

  const handleDeleteOption = (index) => {
    const values = structuredClone(optionList);

    values.splice(index, 1);
    dispatch(setOptionList(values));
    handleCodeUpdates();
  };

  const markCorrect = (index, event) => {
    const values = structuredClone(optionList);

    values[index].correct = event.checked;
    dispatch(setOptionList(values));
    handleCodeUpdates(values);
  };

  return (
    <div>
      <h1>Multiple Choice</h1>
      <div className="p-fluid p-field">
        <label htmlFor="mcStatement">Question Prompt</label>
        <InputTextarea
          id="mcStatement"
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
            <InputTextarea
              value={option.choice}
              placeholder="text or html ok"
              onChange={(e) => handleNewChoice(index, e)}
              onBlur={handleCodeUpdates}
            />
          </div>
          <div className="flex flex-wrap justify-content-left gap-3 mb-4">
            <label>Feedback {index + 1}</label>
            <InputTextarea
              value={option.feedback}
              onChange={(e) => handleNewFeedback(index, e)}
              onBlur={handleCodeUpdates}
            />
            <label>Correct</label>
            <Checkbox checked={option.correct} onChange={(e) => markCorrect(index, e)} />
            {optionList.length > 1 && (
              <Button
                rounded
                outlined
                severity="danger"
                icon="pi pi-trash"
                onClick={() => handleDeleteOption(index)}
              />
            )}
            {index === optionList.length - 1 && (
              <Button
                rounded
                outlined
                severity="success"
                icon="pi pi-plus"
                onClick={handleAddOption}
              />
            )}
            <hr />
          </div>
        </>
      ))}
    </div>
  );
}
