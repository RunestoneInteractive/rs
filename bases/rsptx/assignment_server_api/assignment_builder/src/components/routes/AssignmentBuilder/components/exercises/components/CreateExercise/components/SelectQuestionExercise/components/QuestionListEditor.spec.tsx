import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { QuestionListEditor } from "./QuestionListEditor";

vi.mock("@/hooks/useSmartExerciseSearch", () => {
  const stableResult = {
    exercises: [],
    onGlobalFilterChange: () => {},
    toggleBaseCourse: () => {}
  };

  return { useSmartExerciseSearch: () => stableResult };
});

vi.mock("@/components/ui/ExerciseTypeTag", () => ({
  ExerciseTypeTag: ({ type }: { type: string }) => <span>{type}</span>
}));

vi.mock("./QuestionListEditor.module.css", () => ({ default: {} }));

describe("QuestionListEditor", () => {
  it("shows the empty state when there are no questions", () => {
    renderWithMantine(<QuestionListEditor questionList={[]} onChange={vi.fn()} />);

    expect(screen.getByText("No questions added yet")).toBeInTheDocument();
  });

  it("renders a badge and a row for each added question", () => {
    renderWithMantine(
      <QuestionListEditor
        questionList={[{ questionId: "q1" }, { questionId: "q2" }]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("2 questions")).toBeInTheDocument();
    expect(screen.getByText("q1")).toBeInTheDocument();
    expect(screen.getByText("q2")).toBeInTheDocument();
  });

  it("updates a question label via onChange", () => {
    const onChange = vi.fn();

    renderWithMantine(
      <QuestionListEditor questionList={[{ questionId: "q1" }]} onChange={onChange} />
    );

    fireEvent.change(screen.getByPlaceholderText("Optional display label"), {
      target: { value: "First" }
    });

    expect(onChange).toHaveBeenCalledWith([{ questionId: "q1", label: "First" }]);
  });

  it("removes a question via its remove button", () => {
    const onChange = vi.fn();

    renderWithMantine(
      <QuestionListEditor
        questionList={[{ questionId: "q1" }, { questionId: "q2" }]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove q1" }));

    expect(onChange).toHaveBeenCalledWith([{ questionId: "q2" }]);
  });

  it("clears all questions via Clear All", () => {
    const onChange = vi.fn();

    renderWithMantine(
      <QuestionListEditor questionList={[{ questionId: "q1" }]} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Clear All/ }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("shows the base-course badge when limited", () => {
    renderWithMantine(
      <QuestionListEditor questionList={[]} onChange={vi.fn()} dataLimitBasecourse={true} />
    );

    expect(screen.getByText("Base course only")).toBeInTheDocument();
  });
});
