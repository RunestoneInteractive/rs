import { getSpliceWrapper } from "../getSpliceWrapper";

describe("getSpliceWrapper", () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).spliceWrapper;
  });

  it("returns an already loaded SPLICE wrapper", () => {
    const wrapper = {
      registerGraderFrame: vi.fn(),
      unregisterGraderFrame: vi.fn()
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).spliceWrapper = wrapper;

    expect(getSpliceWrapper()).toBe(wrapper);
  });
});
