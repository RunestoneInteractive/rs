import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithMantine } from "@/test/renderWithMantine";

import { ExerciseTypeTag } from "./ExerciseTypeTag";

vi.mock("@/hooks/useExerciseTypes", () => ({
  useExerciseTypes: () => [
    {
      label: "Active Code",
      value: "activecode",
      tag: "activecode",
      description: "",
      color: { background: "var(--blue-50)", text: "var(--blue-700)" }
    }
  ]
}));

describe("ExerciseTypeTag", () => {
  it("renders the tag label for a known exercise type", () => {
    renderWithMantine(<ExerciseTypeTag type="activecode" />);
    expect(screen.getByText("activecode")).toBeInTheDocument();
  });

  it("renders nothing for an unknown exercise type", () => {
    renderWithMantine(<ExerciseTypeTag type="unknown" />);
    expect(screen.queryByText("activecode")).not.toBeInTheDocument();
  });
});
