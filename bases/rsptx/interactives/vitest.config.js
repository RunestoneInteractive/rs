import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    resolve: {
        alias: [
            // renderComponent.js imports webpack.index.js, which pulls in every
            // component in the book. Tests exercise one component at a time, so
            // stub it out.
            {
                find: /^.*\/renderComponent\.js$/,
                replacement: path.resolve(
                    __dirname,
                    "test-support/stubs/renderComponent.js",
                ),
            },
        ],
    },
    test: {
        environment: "jsdom",
        environmentOptions: {
            jsdom: {
                // provides requestAnimationFrame, needed by CodeMirror
                pretendToBeVisual: true,
                // a real origin so localStorage works
                url: "http://localhost/",
            },
        },
        setupFiles: ["./test-support/setup.js"],
        include: ["runestone/**/test/**/*.test.js"],
        // skulpt.min.js is ~10MB; give the first import time to parse
        testTimeout: 20000,
    },
});
