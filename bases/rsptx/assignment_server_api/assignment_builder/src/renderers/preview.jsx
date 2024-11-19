import PropTypes from "prop-types";
import { useRef, useEffect } from "react";
import { useSelector } from "react-redux";

import { renderRunestoneComponent } from "../componentFuncs";
import { selectCode } from "../state/preview/previewSlice";

import { EditButton } from "./searchPanel";

/**
 * @function Preview
 * @param {object} props
 * @description This component renders the preview of the activecode component
 * @returns The Preview component
 */
export function Preview(props) {
  let code;

  if (props.code != null) {
    console.log("Preview code: ", props.code);
    code = props.code;
  } else {
    code = useSelector(selectCode);
  }
  const ref = useRef();

  // UseEffect accepts a function and an array of dependencies
  // the function tells how to render the component in the future, when one of
  // the dependencies changes.
  useEffect(() => {
    if (!ref.current || code == null || code == "") return;
    ref.current.innerHTML = code;
    renderRunestoneComponent(ref, {});
  }, [code]);

  return (
    <>
      <div ref={ref} />
      <EditButton exercise={props.exercise} />
    </>
  );
}

Preview.propTypes = {
  code: PropTypes.string,
  exercise: PropTypes.object,
};
export default Preview;
