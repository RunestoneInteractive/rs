import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen, waitFor } from "@/test/renderWithMantine";

import { BaseExerciseSettings, BaseExerciseSettingsContent } from "./BaseExerciseSettingsContent";

vi.mock("@/hooks/useExercisesSelector", () => ({
  useExercisesSelector: () => ({
    chapters: [
      { value: "ch1", label: "Chapter 1" },
      { value: "ch2", label: "Chapter 2" }
    ]
  })
}));

vi.mock("@store/dataset/dataset.logic.api", () => ({
  useGetSectionsForChapterQuery: () => ({
    data: [{ value: "sec1", label: "Section 1" }],
    isLoading: false
  })
}));

vi.mock("@/utils/exercise", () => ({
  createExerciseId: () => "generated-id"
}));

const lastSettings = (fn: ReturnType<typeof vi.fn>): BaseExerciseSettings =>
  fn.mock.calls.at(-1)?.[0];

describe("BaseExerciseSettingsContent", () => {
  it("reports defaulted settings on mount", async () => {
    const onSettingsChange = vi.fn();

    renderWithMantine(<BaseExerciseSettingsContent onSettingsChange={onSettingsChange} />);

    await waitFor(() => {
      const settings = lastSettings(onSettingsChange);
      expect(settings.name).toBe("generated-id");
      expect(settings.chapter).toBe("ch1");
      expect(settings.subchapter).toBe("sec1");
      expect(settings.points).toBe(1);
      expect(settings.difficulty).toBe(3);
    });
  });

  it("joins tags into a comma-separated string", async () => {
    const onSettingsChange = vi.fn();

    renderWithMantine(
      <BaseExerciseSettingsContent
        initialData={{ tags: "alpha" }}
        onSettingsChange={onSettingsChange}
      />
    );

    const tagsInput = screen.getByPlaceholderText("Add tags");

    await userEvent.type(tagsInput, "beta{enter}");

    await waitFor(() => {
      expect(lastSettings(onSettingsChange).tags).toBe("alpha,beta");
    });
  });

  it("clears a chapter that does not belong to this book and says why", async () => {
    const onSettingsChange = vi.fn();

    renderWithMantine(
      <BaseExerciseSettingsContent
        initialData={{ chapter: "unit-frq-practice", subchapter: "HiddenWord" }}
        onSettingsChange={onSettingsChange}
      />
    );

    await waitFor(() => {
      expect(lastSettings(onSettingsChange).chapter).toBe("");
    });
    expect(
      screen.getByText("“unit-frq-practice” is not a chapter in this book. Choose one.")
    ).toBeInTheDocument();
  });

  it("keeps a chapter that does belong to this book", async () => {
    const onSettingsChange = vi.fn();

    renderWithMantine(
      <BaseExerciseSettingsContent
        initialData={{ chapter: "ch2", subchapter: "sec1" }}
        onSettingsChange={onSettingsChange}
      />
    );

    await waitFor(() => {
      const settings = lastSettings(onSettingsChange);

      expect(settings.chapter).toBe("ch2");
      expect(settings.subchapter).toBe("sec1");
    });
    expect(screen.queryByText(/is not a chapter in this book/)).not.toBeInTheDocument();
  });

  it("clears a section that does not belong to the selected chapter", async () => {
    const onSettingsChange = vi.fn();

    renderWithMantine(
      <BaseExerciseSettingsContent
        initialData={{ chapter: "ch1", subchapter: "unit1-projects" }}
        onSettingsChange={onSettingsChange}
      />
    );

    await waitFor(() => {
      expect(lastSettings(onSettingsChange).subchapter).toBe("");
    });
    expect(
      screen.getByText("“unit1-projects” is not a section of this chapter. Choose one.")
    ).toBeInTheDocument();
  });

  it("renders the difficulty label for the numeric difficulty value", () => {
    const onSettingsChange = vi.fn();

    renderWithMantine(
      <BaseExerciseSettingsContent
        initialData={{ difficulty: 5 }}
        onSettingsChange={onSettingsChange}
      />
    );

    expect(screen.getByDisplayValue("Very hard")).toBeInTheDocument();
  });
});
