export const RUNESTONE_GRADER_TYPES = new Set([
  "mchoice",
  "clickablearea",
  "dragndrop",
  "fillintheblank",
  "shortanswer",
  "parsonsprob",
  "matching",
  "activecode",
  "actex",
  "codelens",
  "hparsons",
  "lp",
  "webwork",
  "selectquestion"
]);

/** Third-party activities embedded in an iframe rather than Runestone components. */
export const IFRAME_TYPES = new Set(["splice", "doenet", "iframe"]);
