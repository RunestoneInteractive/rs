// Tests for LiveCode's handling of binary files (e.g. a compiled .jar).
//
// runSetup() assembles the list of files to push to Jobe before submitting the
// run.  Binary files are carried as base64 and must be passed to the server
// verbatim -- never base64-encoded again, and never fed to
// parseJavaClasses().  These tests drive runSetup directly with the network
// and CodeMirror machinery stubbed out.
import { describe, it, expect, beforeEach } from "vitest";
import LiveCode from "../js/livecode.js";

// Build a bare LiveCode instance (no DOM component, no CodeMirror), wiring in
// the small set of collaborators runSetup touches, and capturing the file
// objects checkFile is fed.
function makeRunner({
    additionalFiles = "helper-jar",
    compileAlso = undefined,
    pageFiles = [],
} = {}) {
    const lc = Object.create(LiveCode.prototype);
    lc.additional_files = additionalFiles;
    lc.datafiles = undefined;
    lc.language = "python3";
    lc.editor = { getValue: () => "print('hi')" };
    lc.autorun = true;
    lc.historyScrubber = null;
    lc.trimLockedCode = (c) => c;
    lc.output = { innerHTML: "" };
    lc.sourcefile = undefined;
    lc.suffix = undefined;
    lc.prefix = undefined;
    lc.includes = undefined;
    lc.compileAlso = compileAlso;
    lc.jsonHeaders = {};
    lc.div2id = {};
    lc.submitted = [];
    lc.checkFile = async (file, resolve) => {
        lc.submitted.push(file);
        resolve();
    };
    // Place the referenced files in the (jsdom) DOM.
    document.body.innerHTML = pageFiles.join("\n");
    return lc;
}

beforeEach(() => {
    document.body.innerHTML = "";
});

// The DB fallback path in runSetup builds `new Request(relativeUrl)` and then
// `fetch(request)`.  Browser fetch resolves relative URLs against the page
// URL; Node's undici does not, so install a Request that carries the URL and a
// fetch that responds from it.
function stubSourceCodeFetcher(baseCourse, derivedCourse, responsesByUrl) {
    global.Request = class {
        constructor(url, opts) {
            this.url = String(url);
            this.method = (opts && opts.method) || "GET";
            this.headers = (opts && opts.headers) || {};
        }
    };
    global.fetch = async (input) => {
        const url = typeof input === "string" ? input : input.url;
        const response = responsesByUrl[url];
        if (!response) {
            throw new Error(`unexpected fetch: ${url}`);
        }
        const detail = typeof response === "function" ? response() : response;
        return { ok: true, json: () => Promise.resolve(detail) };
    };

    const latest = (acid) =>
        `/ns/assessment/get_latest_code?acid=${encodeURIComponent(acid)}`;
    const source = (acid) =>
        `/ns/logger/get_source_code?course_id=test_course&acid=${encodeURIComponent(acid)}`;
    return { latest, source };
}

function resetFetchers() {
    delete globalThis.Request;
    delete globalThis.fetch;
}

describe("binary files in runSetup", () => {
    it("flags a data-isbinary page element and passes its base64 verbatim", async () => {
        const base64 = "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==";
        const lc = makeRunner({
            additionalFiles: "PTXSB_2_helper-jar",
            pageFiles: [
                `<pre id="PTXSB_2_helper-jar" data-component="datafile" data-filename="helper.jar" data-isbinary="true" data-mime-type="application/java-archive" data-edit="false" data-hidden="">${base64}</pre>`,
            ],
        });
        await lc.runSetup();
        expect(lc.submitted).toHaveLength(1);
        expect(lc.submitted[0]).toEqual({
            name: "helper.jar",
            content: base64,
            isBinary: true,
        });
    });

    it("does not split a binary .jar with parseJavaClasses", async () => {
        const base64 = "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==";
        const lc = makeRunner({
            additionalFiles: "helper-jar",
            pageFiles: [
                `<pre id="helper-jar" data-component="datafile" data-filename="helper.jar" data-isbinary="true" data-mime-type="application/java-archive" data-edit="false" data-hidden="">${base64}</pre>`,
            ],
        });
        lc.parseJavaClasses = (text) => {
            throw new Error("parseJavaClasses must not run on binary data");
        };
        await lc.runSetup();
        expect(lc.submitted).toHaveLength(1);
        expect(lc.submitted[0].isBinary).toBe(true);
    });

    it("flags a DB-sourced file whose is_binary marks it binary", async () => {
        const base64 = "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==";
        const lc = makeRunner({ additionalFiles: "cross-page-jar", pageFiles: [] });
        const latestUrl = `/ns/assessment/get_latest_code?acid=cross-page-jar`;
        const sourceUrl = `/ns/logger/get_source_code?course_id=test_course&acid=cross-page-jar`;
        stubSourceCodeFetcher("test_course", "test_course", {
            [latestUrl]: () => ({
                detail: { code: null },
            }),
            [sourceUrl]: {
                detail: {
                    filename: "helper.jar",
                    file_contents: base64,
                    // True here means binary; text files come back false.
                    is_binary: true,
                },
            },
        });
        await lc.runSetup();
        expect(lc.submitted).toHaveLength(1);
        expect(lc.submitted[0]).toEqual({
            name: "helper.jar",
            content: base64,
            isBinary: true,
        });
        resetFetchers();
    });

    it("treats a fetched file with is_binary false as plain text", async () => {
        const lc = makeRunner({ additionalFiles: "cross-text-file", pageFiles: [] });
        const latest = `/ns/assessment/get_latest_code?acid=cross-text-file`;
        const source = `/ns/logger/get_source_code?course_id=test_course&acid=cross-text-file`;
        stubSourceCodeFetcher("test_course", "test_course", {
            [latest]: () => ({
                detail: { code: null },
            }),
            [source]: {
                detail: {
                    filename: "helper.txt",
                    file_contents: "plain text",
                    // A false is_binary means text, so the client must not
                    // hand the contents to the server as base64.
                    is_binary: false,
                },
            },
        });
        await lc.runSetup();
        expect(lc.submitted).toHaveLength(1);
        expect(lc.submitted[0]).toEqual({
            name: "helper.txt",
            content: "plain text",
        });
        resetFetchers();
    });

    it("adds a binary jar to the Java compile and runtime classpath", async () => {
        const base64 = "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==";
        const lc = makeRunner({
            additionalFiles: "PTXSB_2_helper-jar",
            compileAlso: "helper.jar",
            pageFiles: [
                `<pre id="PTXSB_2_helper-jar" data-component="datafile" data-filename="helper.jar" data-isbinary="true" data-mime-type="application/java-archive" data-edit="false" data-hidden="">${base64}</pre>`,
            ],
        });
        lc.language = "java";
        await lc.runSetup();
        const runspec = JSON.parse(lc.json_runspec).run_spec;
        expect(runspec.parameters.compileargs).toEqual([
            "-cp",
            ".:helper.jar",
        ]);
        // Jobe replaces interpreterargs wholesale, so we must reproduce its
        // Java defaults (the -X flags from java_task.php) and append the -cp.
        expect(runspec.parameters.interpreterargs).toEqual([
            "-Xrs",
            "-Xss8m",
            "-Xmx200m",
            "-cp",
            ".:helper.jar",
        ]);
    });

    it("puts a binary jar on the classpath for Kotlin too", async () => {
        const base64 = "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==";
        const lc = makeRunner({
            additionalFiles: "PTXSB_2_helper-jar",
            compileAlso: "helper.jar",
            pageFiles: [
                `<pre id="PTXSB_2_helper-jar" data-component="datafile" data-filename="helper.jar" data-isbinary="true" data-mime-type="application/java-archive" data-edit="false" data-hidden="">${base64}</pre>`,
            ],
        });
        lc.language = "kotlin";
        await lc.runSetup();
        const runspec = JSON.parse(lc.json_runspec).run_spec;
        expect(runspec.parameters.compileargs).toEqual([
            "-cp",
            ".:helper.jar",
        ]);
        expect(runspec.parameters.interpreterargs).toEqual([
            "-Xrs",
            "-Xss8m",
            "-Xmx200m",
            "-cp",
            ".:helper.jar",
        ]);
    });

    it("does not add a binary jar to the classpath unless it is compile-also", async () => {
        const base64 = "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==";
        const lc = makeRunner({
            additionalFiles: "PTXSB_2_helper-jar",
            pageFiles: [
                `<pre id="PTXSB_2_helper-jar" data-component="datafile" data-filename="helper.jar" data-isbinary="true" data-mime-type="application/java-archive" data-edit="false" data-hidden="">${base64}</pre>`,
            ],
        });
        lc.language = "java";
        await lc.runSetup();
        const runspec = JSON.parse(lc.json_runspec).run_spec;
        expect(runspec.parameters.compileargs).toBeUndefined();
        expect(runspec.parameters.interpreterargs).toBeUndefined();
    });

    it("keeps author-supplied interpreterargs when adding the jar classpath", async () => {
        const base64 = "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==";
        const lc = makeRunner({
            additionalFiles: "PTXSB_2_helper-jar",
            compileAlso: "helper.jar",
            pageFiles: [
                `<pre id="PTXSB_2_helper-jar" data-component="datafile" data-filename="helper.jar" data-isbinary="true" data-mime-type="application/java-archive" data-edit="false" data-hidden="">${base64}</pre>`,
            ],
        });
        lc.language = "java";
        lc.interpreterargs = '["-Xmx512m"]';
        await lc.runSetup();
        const runspec = JSON.parse(lc.json_runspec).run_spec;
        expect(runspec.parameters.interpreterargs).toEqual([
            "-Xmx512m",
            "-cp",
            ".:helper.jar",
        ]);
    });

    it("does not touch the classpath for a non-archive binary file", async () => {
        const base64 = "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==";
        const lc = makeRunner({
            additionalFiles: "PTXSB_2_pic-datafile",
            compileAlso: "pic.png",
            pageFiles: [
                `<pre id="PTXSB_2_pic-datafile" data-component="datafile" data-filename="pic.png" data-isbinary="true" data-mime-type="image/png" data-edit="false" data-hidden="">${base64}</pre>`,
            ],
        });
        lc.language = "java";
        await lc.runSetup();
        const runspec = JSON.parse(lc.json_runspec).run_spec;
        expect(runspec.parameters.compileargs).toBeUndefined();
        expect(runspec.parameters.interpreterargs).toBeUndefined();
    });

    it("puts a binary object file on the C++ linkargs", async () => {
        const base64 = "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==";
        const lc = makeRunner({
            additionalFiles: "PTXSB_2_helper-o",
            compileAlso: "helper.o",
            pageFiles: [
                `<pre id="PTXSB_2_helper-o" data-component="datafile" data-filename="helper.o" data-isbinary="true" data-mime-type="application/octet-stream" data-edit="false" data-hidden="">${base64}</pre>`,
            ],
        });
        lc.language = "cpp";
        await lc.runSetup();
        const runspec = JSON.parse(lc.json_runspec).run_spec;
        expect(runspec.parameters.linkargs).toEqual(["helper.o"]);
        expect(runspec.parameters.compileargs).toBeUndefined();
    });

    it("puts a text source on the C++ compileargs, not linkargs", async () => {
        const lc = makeRunner({
            additionalFiles: "PTXSB_2_addcpp",
            compileAlso: "add.cpp",
            pageFiles: [
                `<pre id="PTXSB_2_addcpp" data-component="datafile" data-filename="add.cpp" data-edit="false" data-hidden="">int add(int a, int b) { return a + b; }</pre>`,
            ],
        });
        lc.language = "cpp";
        await lc.runSetup();
        const runspec = JSON.parse(lc.json_runspec).run_spec;
        expect(runspec.parameters.compileargs).toEqual(["add.cpp"]);
        expect(runspec.parameters.linkargs).toBeUndefined();
    });

    it("does not wire binary compile-also files for Python", async () => {
        const base64 = "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==";
        const lc = makeRunner({
            additionalFiles: "PTXSB_2_pkg-whl",
            compileAlso: "pkg.whl",
            pageFiles: [
                `<pre id="PTXSB_2_pkg-whl" data-component="datafile" data-filename="pkg.whl" data-isbinary="true" data-mime-type="application/octet-stream" data-edit="false" data-hidden="">${base64}</pre>`,
            ],
        });
        lc.language = "python3";
        await lc.runSetup();
        const runspec = JSON.parse(lc.json_runspec).run_spec;
        expect(runspec.parameters.compileargs).toBeUndefined();
        expect(runspec.parameters.linkargs).toBeUndefined();
        expect(runspec.parameters.interpreterargs).toBeUndefined();
    });
});