Developing the Javascript for Runestone Components
--------------------------------------------------

The following is what you need to do to work on the javascript for a component testing it against a local build of a book written in PreTeXt.

1. Make a branch in your clone of ``https://github.com/RunestoneInteractive/rs``

2. Work on the javascript for the component in ``bases/rsptx/interactives/runestone/...``

3. From ``bases/rsptx/interactives`` run ``npm install`` and then ``npm run build -- --env builddir=PATH_TO_BOOK_OUTPUT/_static`` where ``PATH_TO_BOOK`` is a relative or absolute path to the book build folder (and, yes, the double ``--`` are necessary - one set for npm and the other for webpack).

   This should result in the Runestone assets being built in development mode (uncompressed) to ``_static/`` in the book build folder. If you do not set ``--env builddir``, the files will be built to ```bases/rsptx/interactives/runestone/dist``.

   To have webpack monitor for changes, and rebuild the Runestone assets on file change, use ``npm run watch -- --env builddir=PATH_TO_BOOK_OUTPUT/_static``

4. Set a ``stringparams`` in the PreteXt book for ``debug.rs.dev`` to ``true``. This will cause the book to load the development version of the Runestone assets. Without this flag, PreTeXt will look to download production assets from the Runestone CDN.  Note that it is not enough to just copy the new files to ``_static``; the PreTeXt must be built with the flag set for the pages to know what to load.
   
   If using the PreTeXt CLI, version 2.0 or greater, you can add a string param to a build target in your project file (i.e. as a child of the appropriate ``project/targets/target``) by adding the following: ``<stringparams debug.rs.dev="yes"/>``.  
   
   If you don't already have a stringparams element, you might have to change the target from a self-closing tag to an element that can have a child.  Change ``<target name="web" format="html"/>`` to ``<target name="web" format="html"><stringparams debug.rs.dev="yes"/></target>``.

5. Run ``pretext build`` in the root folder of the book

6. Run ``pretext view``

If you change your PreTeXt source, you just need to rerun 5 & 6. If you change your Runestone components code, rerun 3 (or use ``watch``) and then hard refresh your browser (Ctrl-F5).

If you are still working with old RST-based books, you can simply use the ``runestone build`` command which automatically copies the files to the correct location.

Unit tests
~~~~~~~~~~

The components have a `vitest <https://vitest.dev>`_-based unit test suite
that runs in a jsdom environment — no book build, server, or browser needed.
Tests live next to each component in
``runestone/<component>/test/*.test.js``.

Running the tests
.................

From ``bases/rsptx/interactives``::

    npm install        # first time only
    npm test           # run the whole suite once
    npm run test:watch # re-run on file change while developing

To run a single file or filter by test name::

    npx vitest run runestone/activecode/test/activecode.test.js
    npx vitest run -t "history scrubber"

How the harness works
.....................

The pieces, all under ``bases/rsptx/interactives``:

*   ``vitest.config.js`` — configures the jsdom environment and aliases
    ``common/js/renderComponent.js`` to a stub (the real module imports
    ``webpack.index.js`` and with it every component in the repo).
*   ``test-support/setup.js`` — runs before every test file.  It defines a
    minimal logged-out ``eBookConfig``, polyfills ``localStorage``, patches
    jsdom's ``Range`` for CodeMirror, and imports ``bookfuncs.js`` first to
    break the ``bookfuncs``/``runestonebase`` circular import.
*   ``test-support/jquery-globals.js`` — provides the page globals ``$`` and
    ``jQuery`` (plus tiny jQuery UI slider/resizable stubs).  On a real book
    page these come from Sphinx/PreTeXt; in tests, a component that still
    uses jQuery must import this shim explicitly at the top of its test file.
    **Do not import it in tests for a component that has been migrated off
    jQuery** — a passing suite without the shim is the proof that the
    component no longer depends on it.

Writing tests
.............

Tests build a DOM fixture the same way a book page does and construct the
component directly, for example::

    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="activecode" id="test_ac_1" class="ac_section">
          <textarea data-lang="python">print('hello')</textarea>
        </div>
      </div>`;
    let ac = new ActiveCode({
        orig: document.getElementById("test_ac_1"),
        useRunestoneServices: false,
    });

Skulpt really runs Python inside jsdom, so tests can click Run (or call
``runProg()``) and assert on the output.  Note that stdout writes are
appended from short timeouts, so ``await`` a ~50ms delay after ``runProg()``
before asserting on the output element.

If you add a feature or a new component, please include tests that verify it
works.  ``runestone/activecode/test/`` is a good model to copy.
