import { MathJaxWrapper } from "@components/routes/AssignmentBuilder/MathJaxWrapper";
import { MathJax } from "better-react-mathjax";
import { useEffect, useReducer, useRef } from "react";

import { renderRunestoneComponent } from "@/componentFuncs";
import { Exercise } from "@/types/exercises";

export const ExercisePreview = ({
  htmlsrc,
  maxHeight = "600px"
}: Pick<Exercise, "htmlsrc"> & { maxHeight?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (ref.current) {
      console.log("ref here");
      ref.current.innerHTML = htmlsrc;
      renderRunestoneComponent(ref, {}).then(forceUpdate);
    }
  }, [htmlsrc]);

  return (
    <MathJaxWrapper>
      <MathJax>
        <div className="ptx-runestone-container relative">
          <div
            className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
            style={{ maxHeight }}
          >
            <div ref={ref} className="min-w-full"></div>
          </div>
        </div>
      </MathJax>
    </MathJaxWrapper>
  );
};
