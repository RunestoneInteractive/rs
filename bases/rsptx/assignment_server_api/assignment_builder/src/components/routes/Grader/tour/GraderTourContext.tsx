import React, { createContext, useContext, useMemo, useState } from "react";

import type { GraderStudentAnswer } from "@store/grader/grader.logic.api";

interface GraderTourContextValue {
  isDemo: boolean;
  demoSelected: GraderStudentAnswer | null;
  setDemoSelected: (s: GraderStudentAnswer | null) => void;
  setIsDemo: (v: boolean) => void;
}

const Ctx = createContext<GraderTourContextValue | null>(null);

export const GraderTourProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [isDemo, setIsDemo] = useState(false);
  const [demoSelected, setDemoSelected] =
    useState<GraderStudentAnswer | null>(null);

  const value = useMemo<GraderTourContextValue>(
    () => ({ isDemo, setIsDemo, demoSelected, setDemoSelected }),
    [isDemo, demoSelected]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useGraderTourContext = (): GraderTourContextValue => {
  const v = useContext(Ctx);
  if (!v) {
    return {
      isDemo: false,
      demoSelected: null,
      setDemoSelected: () => {},
      setIsDemo: () => {}
    };
  }
  return v;
};

