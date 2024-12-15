import { useEffect, useReducer, useRef } from "react";

import { renderRunestoneComponent } from "@/componentFuncs";
import { Exercise } from "@/types/exercises";

export const ExercisePreview = ({ htmlsrc }: Pick<Exercise, "htmlsrc">) => {
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
    <div className="ptx-runestone-container">
      <div ref={ref}></div>
    </div>
  );
};
