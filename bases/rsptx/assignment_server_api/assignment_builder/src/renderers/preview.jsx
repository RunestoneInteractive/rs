import React from "react";
import { useSelector } from "react-redux";
import { useRef, useEffect } from "react";
import { selectCode } from "../state/preview/previewSlice";
import { renderRunestoneComponent } from "../componentFuncs";
import PropTypes from 'prop-types';

/**
 * @function Preview
 * @param {object} props
 * @description This component renders the preview of the activecode component
 * @returns The Preview component
 */ 
function Preview(props) {
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

    return <div ref={ref} />;
}

Preview.propTypes = {
    code: PropTypes.string,
};
export default Preview;
