import { GraderAnswerHistoryItem } from "@store/grader/grader.logic.api";
import { describe, expect, it } from "vitest";

import { answerForRestore, restoreDataForAttempt } from "./utils";
describe("RunestoneGraderPreview restore data", () => {
  it("parses legacy string matching answers before calling restoreAnswers", () => {
    expect(answerForRestore("matching", '{"connections":[{"from":"left","to":"right"}]}')).toEqual({
      connections: [{ from: "left", to: "right" }]
    });
  });

  it("keeps drag-and-drop JSON serialized because its component parses the string", () => {
    const answer = '{"zone":["item"]}';

    expect(answerForRestore("dragndrop", answer)).toBe(answer);
  });

  it("normalizes a null stored answer to the empty value expected by Runestone components", () => {
    expect(restoreDataForAttempt("mchoice", { id: 2, answer: null }, "student-1").answer).toBe("");
  });

  it("passes Parsons source hashes and drag dimensions through for historical attempts", () => {
    const attempt: GraderAnswerHistoryItem = {
      id: 10,
      answer: "0_0-1_1",
      source: "2_0-3_0",
      min_height: 120,
      drag_width: 80,
      drop_width: 160
    };

    expect(restoreDataForAttempt("parsonsprob", attempt, "student-1")).toEqual({
      ...attempt,
      sid: "student-1"
    });
  });
});
