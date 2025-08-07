.. _development-prerequisites:

Development Environment Pre-Requisites
=======================================

Make sure you have Python installed.  We use 3.13 in production and 3.13 in development.  The web2py server still uses 3.10.  Earlier versions of python are not tested regularly and are not recommended.  macOS is fully supported as well as Ubuntu.  Ubuntu 24.04 comes with Python 3.12 and will likely work just fine.  We jumped from 3.11 to 3.13 so please let us know if 3.12 works without issue. The docker containers are self contained so even on Ubuntu 24.04 they will be fine.

Poetry
------

Runestone uses `Poetry <https://python-poetry.org/docs/>`__ to manage Python dependencies.
You should begin by following the instructions to `install
poetry <https://python-poetry.org/docs/>`__.  Make sure you have at least 2.1.x installed.

After installing Poetry, to support the `polylith structure <https://polylith.gitbook.io/polylith/introduction/polylith-in-a-nutshell>`__
you should install the following plugins to poetry. These will be installed globally in
your copy of poetry. Do the following from a command prompt:

1. ``poetry self add poetry-polylith-plugin``
2. ``poetry self add poetry-multiproject-plugin``
3. ``poetry self add poetry-dotenv-plugin``
4. ``poetry self add poetry-plugin-shell``

Note that before version 2.0 of poetry the ``shell`` subcommand was built in to poetry, but
after 2.0 it was moved to a plugin. If you have an earlier version of poetry, you can skip step 4.
The poetry project recommends using something like ``eval $(poetry env activate)`` instead of the ``poetry shell`` command.  That works great.

.. warning::

   The ``poetry-dotenv-plugin`` causes ``poetry`` to import variables from the ``.env`` file.
   This will make your Runestone installation much more self contained. That is a good thing.

   However, plugins in ``poetry`` are global, not per-project. So if you
   have other ``poetry`` projects with ``.env`` files that you don't want automatically
   used, you may want to not use ``poetry-dotenv-plugin``. In that case, you will need to
   manually set some environment variables on your machine (detailed later).

   Also, if you edit the ``.env`` file, you will need to restart the poetry shell in order for those changes to take effect.

With those installed descend into the Runestone repository by doing ``cd rs`` and run ``poetry poly info``. You should see something like this:


.. code:: shell

   projects: 8
   components: 21
   bases: 9
   development: 1


     brick                   admin_server   assignment_server   author_server   book_server   dash_server   runestone   rsmanage   w2p_login_assign_gr…   development  
 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── 
  .ruff_cache                  -                 -                 -              -             -            -          -                -                  -       
  analytics                    -                 ✔                 -              -             -            -          -                -                  -       
  auth                         ✔                 ✔                 ✔              ✔             -            -          -                -                  ✔       
  build_tools                  -                 -                 ✔              -             -            ✔          ✔                -                  ✔       
  cl_utils                     -                 -                 -              -             -            ✔          ✔                ✔                  ✔       
  configuration                ✔                 ✔                 ✔              ✔             -            ✔          ✔                ✔                  ✔       
  data_extract                 -                 -                 ✔              -             -            -          ✔                -                  ✔       
  data_types                   ✔                 ✔                 ✔              ✔             -            ✔          ✔                ✔                  -       
  db                           ✔                 ✔                 ✔              ✔             -            ✔          ✔                ✔                  ✔       
  endpoint_validators          ✔                 ✔                 ✔              -             -            -          -                -                  -       
  exceptions                   ✔                 ✔                 ✔              ✔             -            -          -                ✔                  ✔       
  forms                        -                 -                 ✔              -             -            -          -                -                  ✔       
  grading_helpers              -                 ✔                 -              ✔             -            -          -                -                  -       
  logging                      ✔                 ✔                 ✔              ✔             -            ✔          ✔                ✔                  ✔       
  lp_sim_builder               -                 ✔                 -              ✔             -            -          -                -                  ✔       
  lti1p3                       ✔                 ✔                 -              ✔             -            -          -                ✔                  ✔       
  practice                     -                 -                 -              ✔             -            -          -                -                  ✔       
  response_helpers             ✔                 ✔                 ✔              ✔             -            ✔          ✔                ✔                  ✔       
  templates                    ✔                 ✔                 ✔              ✔             -            -          -                -                  ✔       
  validation                   ✔                 ✔                 ✔              ✔             -            ✔          ✔                ✔                  ✔       
  visualization                -                 -                 ✔              -             -            -          -                -                  ✔       
  admin_server_api             ✔                 -                 -              -             -            -          -                -                  ✔       
  assignment_server_api        -                 ✔                 -              -             -            -          -                -                  ✔       
  author_server_api            -                 -                 ✔              -             -            -          -                -                  ✔       
  book_server_api              -                 -                 -              ✔             -            -          -                -                  ✔       
  dash_server_api              -                 -                 -              -             ✔            -          -                -                  ✔       
  interactives                 -                 -                 -              -             -            -          -                -                  -       
  library_server               -                 -                 -              -             -            -          -                -                  -       
  rsmanage                     -                 -                 -              -             -            -          ✔                -                  ✔       
  web2py_server                -                 -                 -              -             -            -          -                ✔                  ✔       


This tells you we have 8 projects. There may be more if we haven't kept
this up to date.

The **projects** listed across the top of the table define the artifacts
- Docker images or applications, they could be a web application or a
command line application or other software systems.
The **bases** - contains the public facing API for a project.
The **components** contain code that supports one or more
projects/bases. You can see which projects use which base and
which components by the check marks in the table.

The goal is to put as much code as possible into the components in a way
that is very reusable. For example our database code for doing Create,
Retrieve, Update, and Delete operations in the database is ALL contained
in the db component. You can probably do a lot of very useful
development without having to know anything about database programming
by simply using the functions defined there.

With the structure we have in place, you can run and do development on
any of the server projects **with** or **without** knowing anything about docker
or containers.

Let's discuss each of the projects at a high level to start
with. Then you can find detailed documentation for each project in their
project folder.

**w2p_login_assign_grader** This is a legacy project that uses the
web2py framework and currently supports - login, assignments, grading,
and basic student analytics. We are actively working to migrate each of
those pieces into its own project.

**book_server** The book server is as FastAPI web application that
serves the pages of each textbook to students and handles the API calls
from the interactive components of the textbook. It also serves as the
websocket server for peer instruction.

**admin_server** The admin server is a FastAPI web application that
provides an API for managing the Runestone system. It is used by instructors 
to manage their courses, and contains functionality for LTI 1.3.

**author_server** The author server allows the authors of the textbooks
to build and deploy new versions of their books across the runestone
system. It also contains functionality for authors and researchers to
visualize how their textbooks are used, and to create anonymized data
files for detailed analysis.

**assignment_server** The assignment server is a FastAPI web
application that provides an API for managing assignments, and
submissions. It is used by instructors to create and manage assignments
for their courses. It also provides an API for the book server to
retrieve assignments and submissions for students.

**dash_server** This is a new, modern take on the original student
dashboard, but it will scale up to support very large classes. You can
work on this 100% in python without needing to know css or javascript as
it uses the Dash / Plotly framework.

**rsmanage** This is a command line program for managing courses, users,
and many other aspects of the Runestone system. It is mostly useful for
people running large scale servers.

**jobe** The jobe server is a custom job runner for compiling and
running C, C++, and Java programs.  JOBE is not a python project, so
there is no need to build a wheel for it. However it is a critical part
of the system and you will need to build the docker image.

**nginx** The nginx project uses nginx as the traffic director to route
requests across the various servers that comprise the Runestone system.
Nginx is not a python project, so there is no need to build a wheel for it.
However it is a critical part of the system and you will need to build
the docker image.

**redis** Redis is a key value store that is used for caching and messaging.
It is not a python project, and we use it like it is, so there is no need
to build either a docker image or a wheel for it, we simply pull the latest
from dockerhub.

Docker
------

You need to have `Docker <https://docs.docker.com/get-docker/>`_ and the `compose subcommand <https://github.com/docker/compose/tree/main?tab=readme-ov-file#linux>`_  Make sure you have a recent version of docker compose We are using 2.27 in development.

If you don't know anything about Docker you might want to start here:  `Docker 101 Tutorial <https://www.docker.com/101-tutorial/>`_.  We use docker to create a consistent development environment across all of the servers that make up the Runestone system.  We also use docker to deploy the system to production.


Node and NPM
------------

Finally the runestone components and the new instructor interface use a lot of Javascript. The new instructor interface is being re-written using React.  If you want to hack on any of that you should familiarize yourself with React  There is a `Quick Start <https://react.dev/learn>`_ tutorial for React to get you started.   You will need to have node and npm installed.  We use node 22.1.x and npm 10.5 or later. Unfortunately Ubuntu 22.04 uses an older version of node and many of the packages used by React and our javascript require a later version.   You can install `node and npm <https://github.com/nodesource/distributions/blob/master/README.md>`_ by following the instructions on the node link.  On a mac you can use homebrew to install node and npm.  ``brew install node``. On the mac I am using node 24.4.x and npm 11.4.x.
