/**
 * Tests for merging the server's ``ebook_config_override`` into eBookConfig
 * (issue #1392).  The book server injects the override after the PreTeXt
 * template's own eBookConfig assignments; its values must win.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { applyEbookConfigOverride } from "../js/bookfuncs.js";

describe("applyEbookConfigOverride", () => {
    let saved;

    beforeEach(() => {
        saved = window.eBookConfig;
        delete window.ebook_config_override;
    });

    afterEach(() => {
        window.eBookConfig = saved;
        delete window.ebook_config_override;
    });

    it("overrides template values and keeps the ones it doesn't name", () => {
        window.eBookConfig = {
            course: "from_template",
            isLoggedIn: false,
            enableScratchAC: true,
        };
        window.ebook_config_override = {
            course: "from_server",
            isLoggedIn: true,
            activities: { page: 0 },
        };
        applyEbookConfigOverride();
        expect(window.eBookConfig).toEqual({
            course: "from_server",
            isLoggedIn: true,
            enableScratchAC: true,
            activities: { page: 0 },
        });
    });

    it("extends the existing object rather than replacing it", () => {
        const config = { course: "c" };
        window.eBookConfig = config;
        window.ebook_config_override = { username: "u" };
        applyEbookConfigOverride();
        expect(window.eBookConfig).toBe(config);
        expect(config.username).toBe("u");
    });

    it("leaves eBookConfig alone when there is no override", () => {
        const config = { course: "c" };
        window.eBookConfig = config;
        applyEbookConfigOverride();
        expect(window.eBookConfig).toBe(config);
        expect(config).toEqual({ course: "c" });
    });

    it("creates eBookConfig if the page didn't define one", () => {
        window.eBookConfig = undefined;
        window.ebook_config_override = { course: "c" };
        applyEbookConfigOverride();
        expect(window.eBookConfig).toEqual({ course: "c" });
    });
});
