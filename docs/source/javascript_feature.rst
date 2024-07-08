Developing the Javascript for Runestone Components
--------------------------------------------------

The following is what you need to do to work on the javascript for a component testing it against a local build of a book written in PreTeXt.

1. Make a branch in your clone of ``https://github.com/RunestoneInteractive/rs``

2. Work on the javascript for the component in ``bases/rsptx/interactives/runestone/...``

3. From ``bases/rsptx/interactives`` run ``npm run build -- --env builddir=PATH_TO_BOOK_OUTPUT/_static`` where ``PATH_TO_BOOK`` is a relative or absolute path to the book build folder (and, yes, the double ``--`` are necessary - one set for npm and the other for webpack).

   This should result in the Runestone assets being built in development mode (uncompressed) to ``_static/`` in the book build folder. If you do not set ``--env builddir``, the files will be built to ```bases/rsptx/interactives/runestone/dist``.

   To have webpack monitor for changes, and rebuild the Runestone assets on file change, use ``npm run watch -- --env builddir=PATH_TO_BOOK_OUTPUT/_static``

4. Set a ``stringparam`` in the PreteXt book for ``debug.rs.dev`` to ``true``. This will cause the book to load the development version of the Runestone assets. Without this flag, PreTeXt will look to download production assets from the Runestone CDN.  
   
   If using the PreTeXt CLI, you can add a string param to a build target in your project file (i.e. under ``project/targets/target``) by adding the following: ``<stringparam key="debug.rs.dev" value="true"/>``

5. Run ``pretext build`` in the root folder of the book

6. Run ``pretext view``

If you change your PreTeXt source, you just need to rerun 5 & 6. If you change your Runestone components code, rerun 3 (or use ``watch``) and then hard refresh your browser (Ctrl-F5).

If you are still working with old RST-based books, you can simply use the ``runestone build`` command which automatically copies the files to the correct location.
