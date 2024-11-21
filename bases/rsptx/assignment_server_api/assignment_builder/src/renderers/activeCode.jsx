import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { useSelector, useDispatch } from "react-redux";

import { createActiveCodeTemplate } from "../componentFuncs.js";
import {
  updateField,
  selectInstructions,
  selectLanguage,
  selectStarterCode,
  selectPrefixCode,
  selectSuffixCode,
} from "../state/activecode/acSlice";
import {
  selectUniqueId,
  setQuestionJson,
  setPreviewSrc,
} from "../state/interactive/interactiveSlice";
import { setCode } from "../state/preview/previewSlice";

const acStyle = {
  border: "1px solid black",
  padding: "10px",
};
/**
 *
 * @returns The ActiveCodeCreator component
 * @description This component creates the ActiveCodeCreator component which allows the user to create an activecode component.
 * @namespace ActiveCodeEditor
 *
 */

function ActiveCodeCreator() {
  // use these selectors to get the values from the store (slice for activecode)
  const uniqueId = useSelector(selectUniqueId);
  const instructions = useSelector(selectInstructions);
  const language = useSelector(selectLanguage);
  const starter_code = useSelector(selectStarterCode);
  const prefix_code = useSelector(selectPrefixCode);
  const suffix_code = useSelector(selectSuffixCode);
  const dispatch = useDispatch();

  const previewOnBlur = () => {
    let code = createActiveCodeTemplate(
      uniqueId,
      instructions,
      language,
      prefix_code,
      starter_code,
      suffix_code,
    );

    dispatch(setCode(code));
    dispatch(setQuestionJson({ instructions, language, prefix_code, starter_code, suffix_code }));
    dispatch(setPreviewSrc(code));
  };

  const languageOptions = [
    { value: "python", label: "Python (in browser)" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C++" },
    { value: "c", label: "C" },
    { value: "javascript", label: "Javascript" },
    { value: "html", label: "HTML" },
    { value: "sql", label: "SQL" },
  ];

  return (
    <div style={acStyle}>
      <div className="item">
        <label htmlFor="language">Language</label>
        <Dropdown
          id="language"
          value={language}
          onChange={(e) => dispatch(updateField({ field: "language", newVal: e.value }))}
          options={languageOptions}
          optionLabel="label"
        />
      </div>

      <label htmlFor="instructions" className="builderlabel">
        Instructions
      </label>
      <InputTextarea
        rows={3}
        cols={60}
        id="instructions"
        placeholder="Enter Assignment Instructions (HTML Allowed)"
        value={instructions}
        onBlur={previewOnBlur}
        onChange={(e) => dispatch(updateField({ field: "instructions", newVal: e.target.value }))}
      ></InputTextarea>
      <label htmlFor="prefix_code" className="builderlabel">
        Hidden Prefix Code
      </label>
      <InputTextarea
        rows={4}
        cols={60}
        id="prefix_code"
        placeholder="Enter Assignment Prefix Code"
        value={prefix_code}
        onBlur={previewOnBlur}
        onChange={(e) => dispatch(updateField({ field: "prefix_code", newVal: e.target.value }))}
      ></InputTextarea>
      <label htmlFor="starter_code" className="builderlabel">
        Starter Code
      </label>
      <InputTextarea
        rows={4}
        cols={60}
        id="starter_code"
        placeholder="Enter Assignment Starter Code"
        value={starter_code}
        onBlur={previewOnBlur}
        onChange={(e) => dispatch(updateField({ field: "starter_code", newVal: e.target.value }))}
      ></InputTextarea>
      <label htmlFor="suffix_code" className="builderlabel">
        Hidden Suffix (Test) Code
      </label>
      <InputTextarea
        rows={4}
        cols={60}
        id="suffix_code"
        placeholder="Enter Assignment Suffix (unit test) Code"
        value={suffix_code}
        onBlur={previewOnBlur}
        onChange={(e) => {
          dispatch(
            updateField({
              field: "suffix_code",
              newVal: e.value,
            }),
          );
        }}
      ></InputTextarea>
    </div>
  );
}

export default ActiveCodeCreator;
