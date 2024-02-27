import { useSelector, useDispatch } from "react-redux";
import { useRef, useEffect, useLayoutEffect } from "react";
import { setCode, selectCode } from "../state/preview/previewSlice";
import { renderRunestoneComponent } from "../componentFuncs";

function Preview() {
    const code = useSelector(selectCode);
    const ref = useRef();

    // UseEffect accepts a function and an array of dependencies
    // the function tells how to render the component in the future, when one of
    // the dependencies changes.
    useEffect(() => {
        if (!ref.current || code == null) return;
        ref.current.innerHTML = code;
        renderRunestoneComponent(ref, {});
    }, [code]);

    return <div className="App" ref={ref} />;
}

export default Preview;
