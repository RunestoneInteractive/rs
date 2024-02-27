import { useSelector, useDispatch } from "react-redux";
import { useRef, useEffect, useLayoutEffect } from "react";
import { setCode, selectCode } from "../state/preview/previewSlice";
import { renderRunestoneComponent } from "../componentFuncs";

function Preview() {
    const dispatch = useDispatch();
    const code = useSelector(selectCode);
    const ref = useRef();

    useEffect(() => {
        if (!ref.current || code == null) return;
        ref.current.innerHTML = code;
        renderRunestoneComponent(code, ref, {});
    }, [code]);

    return <div className="App" ref={ref} />;
}

export default Preview;
