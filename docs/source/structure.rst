The Runestone Code
========================

.. _get-the-code:

Getting the Code
------------------

Use the `Github Runestone Code repository <https://github.com/RunestoneInteractive/rs>`_
to obtain the latest source code.

If you are planning on developing, please make your own fork of the code to work in
and submit Pull Requests from it. While developing, please keep your fork up to date
with the Runestone repo to ensure your improvements are compatible with the latest
version of the code.


Project File Structure
----------------------

The code is organized into folders that correspond to concepts from the `polylith
software architecture <https://polylith.gitbook.io/polylith/architecture>`_.
If you don't know what a polylith is don't let that deter you.  It is just a fancy
way of saying that we have a bunch of projects that share a lot of code.

The top level folders are:

-  **projects** - Deployable artifacts. Servers, command line tools, etc...

-  **bases** - The public-facing API for a project

-  **components** - Code that supports one or more projects/bases

-  **development** - Experimental and early work

-  **docs** - Source code for the documentation

-  **tests** - Automated tests for various projects


.. code-block:: text

      📁.
        ├── 📁bases
        │  └── 📁rsptx
        │     ├── 📁author_server_api
        │     ├── 📁book_server_api
        │     ├── 📁dash_server_api
        │     └── 📁rsmanage
        ├── 📁components
        │  └── 📁rsptx
        │     ├── 📁auth
        │     ├── 📁configuration
        │     ├── 📁data_extract
        │     ├── 📁db
        │     ├── 📁forms
        │     ├── 📁logging
        │     ├── 📁lp_sim_builder
        │     ├── 📁response_helpers
        │     ├── 📁validation
        │     └── 📁visualization
        ├── 📁development
        │  └──  core.py
        ├──  docker-compose.yml
        ├── 📁docs
        │  ├── 📁build
        │  │  ├── 📁doctrees
        │  │  └── 📁html
        │  ├── 📁images
        │  │  └──  RunestoneArch.svg
        │  ├──  Makefile
        │  └── 📁source
        ├── 📁projects
        │  ├── 📁author_server
        │  │  ├── 📁dist
        │  │  ├──  Dockerfile
        │  │  ├──  gitconfig
        │  │  ├──  pyproject.toml
        │  │  └──  README.md
        │  ├── 📁book_server
        │  │  ├── 📁dist
        │  │  ├──  Dockerfile
        │  │  ├──  pyproject.toml
        │  │  └──  README.md
        │  ├── 📁dash_server
        │  │  ├── 📁cache
        │  │  ├── 📁dist
        │  │  ├──  Dockerfile
        │  │  ├──  pyproject.toml
        │  │  └──  README.md
        │  ├── 📁jobe
        │  ├── 📁nginx
        │  │  ├──  Dockerfile
        │  └── 📁rsmanage
        │     ├── 📁dist
        │     ├──  uv.lock
        │     └──  pyproject.toml
        ├──  pyproject.toml
        ├──  README.rst
        ├── 📁test
        └──  workspace.toml


