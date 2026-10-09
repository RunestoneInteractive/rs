import { WRAPPER_POLL_MS } from "../../constants";
import { waitForSpliceWrapper } from "../waitForSpliceWrapper";

describe("waitForSpliceWrapper", () => {
  afterEach(() => {
    vi.useRealTimers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).spliceWrapper;
  });

  it("returns an already loaded SPLICE wrapper immediately", async () => {
    const wrapper = {
      registerGraderFrame: vi.fn(),
      unregisterGraderFrame: vi.fn()
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).spliceWrapper = wrapper;

    await expect(waitForSpliceWrapper()).resolves.toBe(wrapper);
  });

  it("waits until the SPLICE wrapper becomes available", async () => {
    vi.useFakeTimers();
    const wrapper = {
      registerGraderFrame: vi.fn(),
      unregisterGraderFrame: vi.fn()
    };
    const waiting = waitForSpliceWrapper();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).spliceWrapper = wrapper;
    await vi.advanceTimersByTimeAsync(WRAPPER_POLL_MS);

    await expect(waiting).resolves.toBe(wrapper);
  });
});
