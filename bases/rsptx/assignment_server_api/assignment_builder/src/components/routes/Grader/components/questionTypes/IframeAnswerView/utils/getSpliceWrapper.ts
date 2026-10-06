import { SpliceGraderApi } from "../types";

export const getSpliceWrapper = (): SpliceGraderApi | undefined =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).spliceWrapper;
