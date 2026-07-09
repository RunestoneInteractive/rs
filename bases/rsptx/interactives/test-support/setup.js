// Global test environment for Runestone component tests.
//
// Book pages (Sphinx/PreTeXt templates) define eBookConfig before any
// component code runs. Tests get a minimal logged-out configuration;
// individual tests may override fields and should restore them afterwards.
globalThis.eBookConfig = {
    useRunestoneServices: false,
    isLoggedIn: false,
    practice_mode: false,
    logLevel: 0,
    course: "test_course",
    basecourse: "test_course",
    email: "test@example.com",
    allow_pairs: false,
    enable_chatcodes: false,
    downloadsEnabled: false,
    isInstructor: false,
    new_server_prefix: "/ns",
    acDefaultLanguage: "python",
    enableScratchAC: false,
};

// bookfuncs.js and runestonebase.js import each other; bookfuncs must be
// evaluated first (as it is in the webpack bundle) or its module-level
// `new RunestoneBase()` runs before the class exists.
import "../runestone/common/js/bookfuncs.js";

// Neither this jsdom version nor Node's flag-gated implementation provides a
// usable localStorage global, so install a simple in-memory one.
function makeStorage() {
    let store = new Map();
    return {
        getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
        setItem: (k, v) => store.set(String(k), String(v)),
        removeItem: (k) => store.delete(String(k)),
        clear: () => store.clear(),
        key: (i) => [...store.keys()][i] ?? null,
        get length() {
            return store.size;
        },
    };
}
for (const name of ["localStorage", "sessionStorage"]) {
    const storage = makeStorage();
    for (const target of [globalThis, window]) {
        Object.defineProperty(target, name, {
            value: storage,
            writable: true,
            configurable: true,
        });
    }
}

// jsdom's Range implementation lacks the measurement APIs CodeMirror uses.
const origCreateRange = document.createRange.bind(document);
document.createRange = () => {
    const range = origCreateRange();
    if (!range.getClientRects) {
        range.getClientRects = () => ({
            length: 0,
            item: () => null,
            [Symbol.iterator]: [][Symbol.iterator],
        });
    }
    if (!range.getBoundingClientRect) {
        range.getBoundingClientRect = () => ({
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            width: 0,
            height: 0,
        });
    }
    return range;
};
