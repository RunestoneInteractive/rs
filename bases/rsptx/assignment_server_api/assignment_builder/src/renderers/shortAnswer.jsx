import { InputSwitch } from "primereact/inputswitch";
import { InputTextarea } from "primereact/inputtextarea";
import { useSelector, useDispatch } from "react-redux";

import { createShortAnswerTemplate } from "../componentFuncs";
import {
  setQuestionJson,
  selectUniqueId,
  setPreviewSrc,
} from "../state/interactive/interactiveSlice";
import { setCode } from "../state/preview/previewSlice";
import {
  setStatement,
  setAttachment,
  selectAttachment,
  selectStatement,
} from "../state/shortanswer/shortSlice";

export function ShortAnswerCreator() {
  const statement = useSelector(selectStatement);
  const attachment = useSelector(selectAttachment);
  const dispatch = useDispatch();
  const uniqueId = useSelector(selectUniqueId);

  function handleCodeUpdates() {
    console.log("Code updates");
    let code = createShortAnswerTemplate(uniqueId, statement, attachment);

    dispatch(setCode(code));
    dispatch(setPreviewSrc(code));
    dispatch(setQuestionJson({ statement, attachment }));
  }

  return (
    <div>
      <h1>Short Answer</h1>
      <div className="p-fluid p-field">
        <label htmlFor="saStatement">Question Prompt</label>
        <InputTextarea
          id="saStatement"
          placeholder="Question"
          value={statement}
          onChange={(e) => dispatch(setStatement(e.target.value))}
          onBlur={handleCodeUpdates}
        />
      </div>
      <div className="field grid">
        <InputSwitch
          id="allowAttch"
          className="field"
          checked={attachment}
          onChange={(e) => dispatch(setAttachment(e.value))}
        />
        <label htmlFor="allowAttch" className="col-fixed">
          Allow Attachments
        </label>
      </div>
    </div>
  );
}
