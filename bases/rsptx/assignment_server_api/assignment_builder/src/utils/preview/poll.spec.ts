import { generatePollPreview } from "./poll";

const pollElement = (html: string) =>
  new DOMParser().parseFromString(html, "text/html").querySelector('[data-component="poll"]');

const pollId = (html: string): string | null => pollElement(html)?.getAttribute("id") ?? null;

describe("generatePollPreview", () => {
  // poll.js logs votes, remembers who voted and fetches results by the
  // element id, so it must be the question's name and unique per poll.
  it.each(["options", "scale"])("uses the question name as the %s poll's id", (pollType) => {
    expect(pollId(generatePollPreview("How was it?", ["1", "2"], "my_poll", pollType))).toBe(
      "my_poll"
    );
  });

  it("gives two scale polls different ids", () => {
    const first = generatePollPreview("Rate A", ["1", "2"], "poll_a", "scale");
    const second = generatePollPreview("Rate B", ["1", "2"], "poll_b", "scale");

    expect(pollId(first)).not.toBe(pollId(second));
  });

  // poll.js shows students the results only when data-results is "all".
  it.each(["options", "scale"])(
    "shows a %s poll's results to instructors by default",
    (pollType) => {
      const html = generatePollPreview("How was it?", ["1", "2"], "my_poll", pollType);

      expect(pollElement(html)?.getAttribute("data-results")).toBe("instructor");
    }
  );

  it.each(["options", "scale"])("can show a %s poll's results to everyone", (pollType) => {
    const html = generatePollPreview("How was it?", ["1", "2"], "my_poll", pollType, "all");

    expect(pollElement(html)?.getAttribute("data-results")).toBe("all");
  });
});
