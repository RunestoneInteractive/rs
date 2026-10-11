import { WRAPPER_POLL_MS, WRAPPER_TIMEOUT_MS } from "../constants";
import { SpliceGraderApi } from "../types";

import { getSpliceWrapper } from "./getSpliceWrapper";

/** Wait until the asynchronously loaded Runestone SPLICE wrapper is ready. */
export const waitForSpliceWrapper = (): Promise<SpliceGraderApi | undefined> => {
  const existing = getSpliceWrapper();

  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let waited = 0;
    const timer = setInterval(() => {
      const wrapper = getSpliceWrapper();

      waited += WRAPPER_POLL_MS;
      if (wrapper || waited >= WRAPPER_TIMEOUT_MS) {
        clearInterval(timer);
        resolve(wrapper);
      }
    }, WRAPPER_POLL_MS);
  });
};
