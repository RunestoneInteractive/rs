import { expect, test } from "../fixtures/scratch";

const MAX_REDUCED_DURATION_MS = 0.01;

const toMs = (value: string): number => {
  const part = value.split(",")[0].trim();

  return part.endsWith("ms") ? parseFloat(part) : parseFloat(part) * 1000;
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test(
  "reduced motion kills transitions and animations app-wide",
  { tag: ["@p2", "@responsive", "@a11y", "@assignments"] },
  async ({ page }) => {
    await page.goto("/builder");
    await expect(page.getByRole("heading", { level: 1, name: "Assignments" })).toBeVisible();

    const prefersReduced = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    expect(prefersReduced, "prefers-reduced-motion emulation active").toBe(true);

    const durations = await page.evaluate(() => {
      const sample = [
        document.body,
        document.querySelector("button"),
        document.querySelector("a"),
        document.querySelector("h1")
      ].filter(Boolean) as Element[];

      return sample.map((el) => {
        const cs = getComputedStyle(el);

        return {
          tag: el.tagName,
          transition: cs.transitionDuration,
          animation: cs.animationDuration
        };
      });
    });

    for (const entry of durations) {
      expect(toMs(entry.transition), `${entry.tag} transition-duration`).toBeLessThanOrEqual(
        MAX_REDUCED_DURATION_MS
      );
      expect(toMs(entry.animation), `${entry.tag} animation-duration`).toBeLessThanOrEqual(
        MAX_REDUCED_DURATION_MS
      );
    }
  }
);

test(
  "reduced motion applies inside an open modal",
  { tag: ["@p2", "@responsive", "@a11y", "@assignments"] },
  async ({ page }) => {
    await page.goto("/builder");

    const deleteButton = page.getByRole("button", { name: "Delete" }).first();

    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const dialog = page.getByRole("dialog");

    await expect(dialog).toBeVisible();

    const modalDurations = await page.evaluate(() => {
      const content = document.querySelector(".mantine-Modal-content");

      if (!content) return null;
      const cs = getComputedStyle(content);

      return { transition: cs.transitionDuration, animation: cs.animationDuration };
    });

    expect(modalDurations).not.toBeNull();
    expect(toMs(modalDurations!.transition)).toBeLessThanOrEqual(MAX_REDUCED_DURATION_MS);
    expect(toMs(modalDurations!.animation)).toBeLessThanOrEqual(MAX_REDUCED_DURATION_MS);

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  }
);
