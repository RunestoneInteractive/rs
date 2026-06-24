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
