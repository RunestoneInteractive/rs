import { MathJaxWrapper } from "@components/routes/AssignmentBuilder/MathJaxWrapper";
import { MathJax } from "better-react-mathjax";
import React, { useEffect, useReducer, useRef } from "react";

import { renderRunestoneComponent } from "@/componentFuncs";

import { AnswerRendererProps } from "./types";

export const RunestonePreview: React.FC<{ htmlsrc?: string; divId: string }> = ({
  htmlsrc,
  divId
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (!ref.current || !htmlsrc) return;
    ref.current.innerHTML = htmlsrc;
    renderRunestoneComponent(ref, { isCalledFromBuilder: true, graderactive: false })
      .then(forceUpdate)
      .catch(() => undefined);

  }, [htmlsrc, divId]);

  if (!htmlsrc) {
    return (
      <div style={{ padding: "1rem", color: "#64748b" }}>
        No rendered question preview available.
      </div>
    );
  }

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
              border: 1px solid #e2e8f0;
              padding: 0.5rem;
              position: relative;
              vertical-align: top;
              min-width: 100px;
            }
            .ptx-runestone-container th {
              background: #f8fafc;
              font-weight: 600;
              text-align: left;
            }
          `}
        </style>
        <div className="ptx-runestone-container runestone relative flex justify-content-center w-full">
          <div className="flex justify-content-center">
            <div ref={ref} className="text-left mx-auto" />
          </div>
        </div>
      </MathJax>
    </MathJaxWrapper>
  );
};

export const QuestionPreviewHeader: React.FC<
  Pick<AnswerRendererProps, "htmlsrc" | "questionName">
> = ({ questionName }) => (

  <section style={{ marginBottom: "0.5rem" }}>
    <h4 style={{ margin: "0 0 0.25rem 0", color: "#0f172a", fontSize: 13 }}>
      Question: <span style={{ fontFamily: "monospace" }}>{questionName}</span>
    </h4>
  </section>
);

