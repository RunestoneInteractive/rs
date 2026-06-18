import { MathJaxWrapper } from "@components/routes/AssignmentBuilder/MathJaxWrapper";
import { MathJax } from "better-react-mathjax";
import { useEffect, useReducer, useRef } from "react";

import { renderRunestoneComponent } from "@/componentFuncs";
import { Exercise } from "@/types/exercises";

export const ExercisePreview = ({
  htmlsrc
}: Pick<Exercise, "htmlsrc"> & { maxHeight?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = htmlsrc;
      renderRunestoneComponent(ref, { isCalledFromBuilder: true }).then(forceUpdate);
    }
  }, [htmlsrc]);

  return (
    <MathJaxWrapper>
      <MathJax>
        <style>
          {`
            .ptx-runestone-container .CodeMirror-scroll {
              max-height: none !important;
            }
            .ptx-runestone-container .CodeMirror {
              height: auto !important;
            }
            .ptx-runestone-container table {
              border-collapse: collapse;
              margin: 1rem 0;
              width: 100%;
              table-layout: fixed;
            }
            .ptx-runestone-container th,
            .ptx-runestone-container td {
              border: 1px solid var(--rs-border-solid);
              padding: 0.5rem;
              position: relative;
              vertical-align: top;
              min-width: 100px;
            }
            .ptx-runestone-container th {
              background: var(--rs-neutral-50);
              font-weight: 600;
              text-align: left;
            }
          `}
        </style>
        <div className="ptx-runestone-container relative flex justify-content-center w-full">
          <div className="flex justify-content-center">
            <div ref={ref} className="text-left mx-auto"></div>
          </div>
        </div>
      </MathJax>
    </MathJaxWrapper>
  );
};
