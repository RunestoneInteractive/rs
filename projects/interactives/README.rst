The Runestone interactive components (activecode, CodeLens, Parsons, multiple choice, and the rest) as they are used in `PreTeXt <https://pretextbook.org>`_ books. The source lives in ``bases/rsptx/interactives``; this folder holds the scripts that build and release it.

Runestone Version 8
-------------------
Version 8 and beyond just support the components as they are used in PreTeXt. Releases are JavaScript only; nothing is published to PyPI.

If you need to build a book using the old RST markup language, you can use version 7.13.x of the runestone package.  You can install that version using pip like this:

.. code-block:: bash

    pip install runestone==7.13.5


If you need to fix a bug in the old RST version you can clone the repository and checkout the legacy_support branch.  That branch will be maintained with bug fixes for the RST version of the components, but no new features will be added to that branch.  The main branch is used for development of the components as they are used in PreTeXt.

Building and Releasing
----------------------

Run these from this folder with the rs virtual environment active.

To build the components into a book you are working on (``<book>`` is a book directory under ``$BOOK_PATH``):

.. code-block:: bash

    ./build.py --dev --to <book>

The release version is the ``version`` field of ``bases/rsptx/interactives/package.json``.  To make a release, bump it, then build and publish:

.. code-block:: bash

    (cd ../../bases/rsptx/interactives && npm version X.Y.Z --no-git-tag-version)
    ./build.py --publish
    ./make_release.sh vX.Y.Z

``--publish`` packages ``runestone/dist`` as ``dist-X.Y.Z.tgz``, installs it on the CDN, tags the repo ``components_X.Y.Z``, and moves the tarball to ``jsdist``.  It needs ssh access to the Runestone CDN host.  ``make_release.sh`` creates the matching GitHub release (it needs an authenticated ``gh`` CLI).

Documentation
-------------

Writing **new** books using the Runestone RST markup language is deprecated as of Summer 2022.  It is strongly recommended that you use the `PreTeXt <https://pretextbook.org>`_ markup language for writing new books.

* Take a look at the `Sample Book <https://pretextbook.org/examples/sample-book/annotated/sample-book.html>`_ Especially Chapter 3, the section titled Interactive Exercises.  The activecode, CodeLens and all the rest of the interactives that you see in that sample book are powered by the components in this repository.  This repository will remain the home of those interactive components.

* Take a look at the `PreTeXt Guide <https://pretextbook.org/doc/guide/html/guide-toc.html>`_ It contains comprehensive documentation on writing in PreTeXt.

* As an Author you will want to use the PreTeXt CLI for writing books. See `PreTeXt-CLI <https://pretextbook.org/doc/guide/html/guide-toc.html>`_

Quick Start
-----------

* ``pip install pretext``
* Create a folder for your book project then run
* ``pretext new`` to create a new book.

Developing
----------

See ``bases/rsptx/interactives/AGENTS.md`` and ``docs/source/javascript_feature.rst`` for how the components are organized and tested.  From ``bases/rsptx/interactives``, ``npm test`` runs the vitest suite.

Researchers
-----------

If you use Runestone in your Research or write about it, please reference ``https://runestone.academy`` and cite this paper:

.. code-block:: bibtex

   @inproceedings{Miller:2012:BPE:2325296.2325335,
    author = {Miller, Bradley N. and Ranum, David L.},
    title = {Beyond PDF and ePub: Toward an Interactive Textbook},
    booktitle = {Proceedings of the 17th ACM Annual Conference on Innovation and Technology in Computer Science Education},
    series = {ITiCSE '12},
    year = {2012},
    isbn = {978-1-4503-1246-2},
    location = {Haifa, Israel},
    pages = {150--155},
    numpages = {6},
    url = {http://doi.acm.org/10.1145/2325296.2325335},
    doi = {10.1145/2325296.2325335},
    acmid = {2325335},
    publisher = {ACM},
    address = {New York, NY, USA},
    keywords = {cs1, ebook, sphinx},
   }
