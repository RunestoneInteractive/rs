import React from "react";
import { useSelector } from "react-redux";
import { useRef, useEffect } from "react";
import { selectCode } from "../state/preview/previewSlice";
import { renderRunestoneComponent } from "../componentFuncs";

function Preview() {
    const code = useSelector(selectCode);
    const ref = useRef();

    // UseEffect accepts a function and an array of dependencies
    // the function tells how to render the component in the future, when one of
    // the dependencies changes.
    useEffect(() => {
        if (!ref.current || code == null || code == "") return;
        ref.current.innerHTML = code;
        renderRunestoneComponent(ref, {});
    }, [code]);

    return <div className="App" ref={ref} />;
}

export default Preview;
