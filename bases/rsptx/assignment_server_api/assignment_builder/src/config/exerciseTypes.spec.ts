import { supportedExerciseTypes } from "@/types/exercises";

import {
  ExerciseFamily,
  exerciseFamilies,
  getExerciseColorScheme,
  getExerciseFamily,
  getExerciseTypeIcon
} from "./exerciseTypes";

describe("exerciseTypes color mapping", () => {
  it.each([...supportedExerciseTypes])(
    "returns a defined --rs-extype token triple for %s",
    (type) => {
      const scheme = getExerciseColorScheme(type);

      expect(scheme.hue).toMatch(/^var\(--rs-extype-(choice|code|interactive|text|meta)\)$/);
      expect(scheme.background).toMatch(
        /^var\(--rs-extype-(choice|code|interactive|text|meta)-bg\)$/
      );
      expect(scheme.text).toMatch(/^var\(--rs-extype-(choice|code|interactive|text|meta)-text\)$/);
    }
  );

  it("uses the same family for all three tokens of a type", () => {
    supportedExerciseTypes.forEach((type) => {
      const family = getExerciseFamily(type);
      const scheme = getExerciseColorScheme(type);

      expect(scheme.hue).toBe(`var(--rs-extype-${family})`);
      expect(scheme.background).toBe(`var(--rs-extype-${family}-bg)`);
      expect(scheme.text).toBe(`var(--rs-extype-${family}-text)`);
    });
  });

  it("maps every supported type to its planned family", () => {
    const expected: Record<string, ExerciseFamily> = {
      mchoice: "choice",
      poll: "choice",
      activecode: "code",
      parsonsprob: "code",
      dragndrop: "interactive",
      matching: "interactive",
      clickablearea: "interactive",
      fillintheblank: "text",
      shortanswer: "text",
      selectquestion: "meta",
      iframe: "meta"
    };

    supportedExerciseTypes.forEach((type) => {
      expect(getExerciseFamily(type)).toBe(expected[type]);
    });
  });

  it("falls back to the meta family for unknown types", () => {
    expect(getExerciseFamily("webwork")).toBe("meta");
    expect(getExerciseColorScheme("something-new").background).toBe("var(--rs-extype-meta-bg)");
  });

  it("covers every supported exercise type across the family groups", () => {
    const grouped = Object.values(exerciseFamilies).flatMap((family) => family.types);

    expect([...grouped].sort()).toEqual([...supportedExerciseTypes].sort());
  });

  it("gives every supported type a distinct icon and unknown types a fallback", () => {
    const icons = supportedExerciseTypes.map((type) => getExerciseTypeIcon(type));

    expect(new Set(icons).size).toBe(supportedExerciseTypes.length);
    expect(getExerciseTypeIcon("unknown-type")).toBe("file-edit");
  });

  it("labels the five families for the type-select grid", () => {
    expect(Object.keys(exerciseFamilies)).toEqual([
      "choice",
      "code",
      "interactive",
      "text",
      "meta"
    ]);
    expect(Object.values(exerciseFamilies).map((f) => f.label)).toEqual([
      "Choice",
      "Code",
      "Interactive",
      "Text",
      "Meta"
    ]);
  });
});
