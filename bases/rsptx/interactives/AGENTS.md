# interactives — agent guide

The JavaScript for Runestone's interactive components (multiple choice, activecode,
parsons, ...). The same bundle runs inside PreTeXt books, Sphinx (RST) books, and the
assignment server's pages. Repo-wide setup and traps are in the root `AGENTS.md`.

| Path | Role |
|---|---|
| `runestone/<component>/js/` | Component code; a `timed*.js` subclass for timed exams |
| `runestone/<component>/css/` | Component styles |
| `runestone/<component>/test/*.test.js` | vitest unit tests |
| `runestone/common/js/runestonebase.js` | `RunestoneBase`: logging, saving and restoring answers |
| `runestone/common/js/rsi18n.js` | i18n: `load(messages)`, `t(key, ...args)` |
| `runestone/common/js/domutil.js` | Small replacements for jQuery helpers |
| `runestone/common/css/variables.less` | Theme colors for light and both dark themes |
| `webpack.index.js` | `module_map`: `data-component` name → module to load |
| `test-support/` | vitest setup, the jQuery shim, module stubs |

## Adding or changing a component

- **Registration:** a component loads only if its `data-component` name is a key in
  `module_map` in `webpack.index.js`, and its module sets
  `window.component_factory.<name>`. The two must stay in sync.
- **Base class:** extend `RunestoneBase` and implement `checkLocalStorage`,
  `setLocalStorage` and `restoreAnswers`; the base class's `checkServer` decides which
  of those to call. Log answers with `logBookEvent`; the book server grades from that.
- **Text shown to students** goes through `t("key")` from `rsi18n.js`, with the strings
  in the component's `*-i18n.<lang>.js` catalog. `t()` substitutes `$1`, `$2`
  arguments itself. The old `$.i18n` library is gone; see `I18N.md`.
- **No new jQuery.** Every component except codelens is jQuery-free. Codelens still
  needs it because the vendored `pytutor-embed.bundle.js` requires page jQuery and
  jQuery UI, which is why `jquery` is still a webpack external. Use `domutil.js` or
  plain DOM APIs.

## Traps

- **A fix on `main` doesn't reach RST books.** They get their JS from the `runestone`
  PyPI package, built from the `legacy_support` branch, which has its own copy of
  this code. Port the fix there if RST books need it.
- **Theme colors must be variables.** Shared and many component styles are imported
  *inside* `.ptx-runestone-container, .runestone-sphinx { ... }` (see
  `ptxrs-bootstrap.less`), so a `:root.dark-mode` selector in those files turns into a
  descendant selector that never matches. Add the color to all three theme blocks in
  `variables.less` instead. A dark block that omits a key silently inherits the light
  value. `--content-background` exists only in PreTeXt books.
- **Don't hard-code colors in JS** (e.g. inline `backgroundColor = "#fff"` during an
  animation). It breaks dark mode; read a CSS variable or toggle a class.
- **Codelens CSS lives in two places.** `pytutor-embed.bundle.js` embeds its own copy
  of `codelens/css/pytutor.css` as a string; editing the `.css` file alone changes
  nothing.
- **Don't run `prettier --write` on a whole file you're only touching a little.**
  `.prettierrc` exists (tab width 4), but not every file is prettier-clean, and a
  full-file reformat buries your change in churn. Format only what you changed.
- **Never put `border-radius` on an embedded activity's `<iframe>`** (SPLICE, Doenet).
  Chromium clips it through a separate layer and Doenet fails to start, leaving a
  blank frame. Put rounded corners on a wrapping element.

## Tests

`npm test` from this directory runs the whole vitest suite in jsdom; no build, server
or browser needed. Details are in the Unit tests section of
`docs/source/javascript_feature.rst`.

- `test-support/setup.js` runs first: a logged-out `eBookConfig`, a `localStorage`
  polyfill, and CodeMirror fixes.
- A test for a jQuery-free component must **not** import
  `test-support/jquery-globals.js`. The suite passing without it is the proof the
  component doesn't use jQuery.
- jsdom has no layout: `getBoundingClientRect` returns zeros and `innerText`
  doesn't render. Assert on DOM structure and membership, not position or visible text.

To see a change in a real book, build into its `_static` folder (needs `BOOK_PATH`):

```bash
cd projects/interactives
./build.py --dev --to <book>   # <book> = a book directory under $BOOK_PATH
```

Then load a page of that book through the local server. If you build a standalone
test page instead, wrap components in `<div class="runestone-sphinx">`. Without it
the scoped CSS doesn't apply and the page renders plausible-looking browser defaults.
