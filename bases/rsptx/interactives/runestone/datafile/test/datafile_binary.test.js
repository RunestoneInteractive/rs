// Characterization tests for the DataFile component's handling of binary
// files.  A binary file (e.g. a compiled .jar) is registered as a hidden
// <pre> carrying its base64 representation plus a data-isbinary attribute.
// The component replaces that <pre> with a container that must keep those
// attributes so LiveCode can still find them.
import { describe, it, expect, beforeEach } from "vitest";
// datafile.js has no exports; it registers a component_factory on window.
import "../js/datafile.js";

function makeFixture(attrs = "", content = "") {
    document.body.innerHTML = `
      <div class="runestone">
        <pre data-component="datafile" id="binary_1" style="display: block" ${attrs}>${content}</pre>
      </div>`;
    return document.querySelector("[data-component=datafile]");
}

beforeEach(() => {
    document.body.innerHTML = "";
});

describe("DataFile", () => {
    it("preserves data-isbinary on the rendered container", () => {
        const orig = makeFixture(
            'data-filename="helper.jar" data-isbinary="true" ' +
                'data-mime-type="application/java-archive" data-edit="false" data-hidden=""',
            "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==",
        );
        const df = window.component_factory.datafile({ orig });
        expect(df.containerDiv.id).toBe("binary_1");
        expect(df.containerDiv.dataset.isbinary).toBe("true");
        expect(df.containerDiv.dataset.filename).toBe("helper.jar");
        expect(df.containerDiv.textContent).toBe(
            "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==",
        );
    });

    it("does not mark an ordinary text file as binary", () => {
        const orig = makeFixture('data-filename="helper.txt" data-edit="false"', "hello");
        const df = window.component_factory.datafile({ orig });
        expect(df.isBinary).toBe(false);
        expect(df.containerDiv.dataset.isbinary).toBeUndefined();
    });
});