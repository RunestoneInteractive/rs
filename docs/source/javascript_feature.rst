Developing the Javascript for Runestone Components
--------------------------------------------------

The following is what you need to do to work on the javascript for a component testing it against a local build of a book written in PreTeXt.

1. Make a branch in your clone of ``https://github.com/RunestoneInteractive/rs``
2. Work on the javascript for the component in ``bases/rsptx/interactives/runestone/...``
3. Run ``poetry install --with=dev`` in the root folder of your clone of ``rs``
4. Start up a ``poetry shell`` in the root folder of your clone of ``rs``
5. From ``bases/rsptx/interactives`` run ``npm run build`` → results in ``runestone/dist``
6. From ``bases/rsptx/interactives`` run ``python ./scripts/dist2xml.py test`` → creates webpack_static_imports.xml and sets up for the files to be in ``_static/test`` in the resulting local build of your PreTeXt book.
7. Set:``<stringparam key="debug.rs.services.file" value="file:////your/home/rs/bases/interactives/runestone/dist/webpack_static_imports.xml" />`` in the ``project.pxt`` file of the book.
8. Run ``pretext build`` in the root folder of the book
9. ``mkdir -p build/html/_static/test``
10. Copy the contents of ``.../rs/bases/rsptx/interactives/runestone/dist`` to ``build/html/_static/test``
11. Run ``pretext view``

If you are still working with old RST based books, you can simply use the ``runestone build`` command which automatically copies the files to the correct location.
