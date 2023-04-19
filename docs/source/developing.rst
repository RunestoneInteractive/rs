Developing
==========

This repository uses a polylith structure in order to allow the several
projects under the Runestone umbrella to share code, provide common ways
of accomplishing similar tasks, and hopefully make it easier for a
newcomer to contribute to the project.

To get started it will be very helpful to `install
poetry <https://python-poetry.org/docs/>`__. with poetry installed you
will need to add two very important plugins.

1. ``poetry self add poetry-polylith-plugin``
2. ``poetry self add poetry-multiproject-plugin``

With those installed go ahead and run ``poetry poly info``

.. code:: shell

   projects: 7
   components: 11
   bases: 5
   development: 1

     brick                author_server  book_server  dash_server  jobe  nginx  rsmanage  w2p_login_assign_grade development
    ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

     auth                      ✔             ✔            -            -            -            -            -         ✔
     configuration             ✔             ✔            -            -            -            ✔            -         -
     data_extract              ✔             -            -            -            -            -            -         ✔
     db                        ✔             ✔            -            -            -            ✔            -         ✔
     forms                     ✔             -            -            -            -            -            -         ✔
     logging                   ✔             ✔            -            -            -            ✔            -         ✔
     lp_sim_builder            -             ✔            -            -            -            -            -         -
     response_helpers          ✔             ✔            -            -            -            ✔            -         ✔
     validation                ✔             ✔            -            -            -            ✔            -         ✔
     visualization             ✔             -            -            -            -            -            -         ✔
     author_server_api         ✔             -            -            -            -            -            -         ✔
     book_server_api           -             ✔            -            -            -            -            -         ✔
     dash_server_api           -             -            ✔            -            -            -            -         -
     rsmanage                  -             -            -            -            -            ✔            -         ✔
     web2py_server             -             -            -            -            -            -            ✔         ✔

This tells you we have 7 projects. There may be more if we haven't kept
this up to date.

The **projects** listed across the top of the table define the artifacts
- Docker images or applications, they could be a web application or a
command line application or whatever. The **bases** - contains the
public facing API for a project. The **components** contain code that
supports one or more projects/bases. You can see which projects use
which base and which components by the check marks in the table.

The goal is to put as much code as possible into the components in a way
that is very reusable. For example our database code for doing Create,
Retrieve, Update, and Delete operations in the database is ALL contained
in the db component. You can probably do a lot of very useful
development without having to know anything about database programming
by simply using the functions defined there.

With the structure we have in place, you can run and do development on
any of the server projects with or without knowing anything about docker
or containers.

Let's discuss discuss each of the projects at a high level to start
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

**author_server** The author server allows the authors of the textbooks
to build and deploy new versions of their books across the runestone
system. It also contains functionality for authors and researchers to
visualize how their textbooks are used, and to create anonymized data
files for detailed analysis.

**dash_server** This is a new, modern take on the original student
dashboard, but it will scale up to support very large classes. You can
work on this 100% in python without needing to know css or javascript as
it uses the Dash / Plotly framework.

**rsmanage** This is a command line program for managing courses, users,
and many other aspects of the Runestone system. It is mostly useful for
people running large scale servers.

**jobe** The jobe server is a custom job runner for compiling and
running C, C++, and Java programs.

**nginx** The nginx project uses nginx as the traffic director to route
requests across the various servers that comprise the Runestone system.

Project File Structure
----------------------

.. code-block:: text

      📁.
        ├── 📁bases
        │  └── 📁rsptx
        │     ├── 📁author_server_api
        │     ├── 📁book_server_api
        │     ├── 📁dash_server_api
        │     ├── 📁rsmanage
        │     └── 📁web2py_server
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
        │  ├── 📁graffle
        │  │  └──  Phased Approach to Polylith.graffle
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
        │  ├── 📁rsmanage
        │  │  ├── 📁dist
        │  │  ├──  poetry.lock
        │  │  └──  pyproject.toml
        │  └── 📁w2p_login_assign_grade
        │     ├── 📁dist
        │     ├──  Dockerfile
        │     └──  pyproject.toml
        ├──  pyproject.toml
        ├──  README.rst
        ├── 📁test
        └──  workspace.toml


Database Setup
--------------

The database is a critical component as it is the glue that ties together the various servers.  You have a few different options for database setup.

1. Use SQLLite -- this may be ok for very casual use or even light development work, but really is  not ideal for any kind of production environment.
2. Install Postgresql as part of the docker-compose setup
3. Install Postgresql on your local host (either natively or in a container)

My currently recommended option is number 3.  It is what you are probably going to want for production anyway, and I think it gives you the most flexibility for development.  I simply installed it on my mac using ``homebrew.`` Linux users can use ``apt`` or whatever.  You could even install it in its own `docker container <https://www.baeldung.com/ops/postgresql-docker-setup>`_ and access it as if it was installed natively.  It is easy for services running in docker to access the database service running on the host.  Using  a URL like ``postgresql://user:pass@host.docker.internal/runestone_dev``  The key there is the ``host.docker.internal`` tells the process running in the container to connect to the host.  Running it on the host also makes it far less surprising when you do a rebuild and suddenly your test data is gone because you dumped the image.

You can connect to the database with one of 3 URLs depending on your server configuration (``SERVER_CONFIG``) environment variable - production, development, or test.  Test is really just for unit testing.  So you will most often want to use development.  The environment variables to set are ``DBURL``, ``DEV_DBURL`` or ``TEST_DBURL``.

If you install postgresql locally you will need to do  a few things to get it ready to go.  

1. Create a user called ``runestone`` with password ``runestone`` (or whatever you want to call it) This is done by running ``createuser -P runestone`` and entering the password when prompted.  You can also do this in the psql command line interface by running ``create user --superuser runestone with password 'runestone';``  You may have to become the postgres user in order to run that command.
2. You will also find it convenient to create a user for yourself.  This is done by running ``createuser -P <your username>`` and entering the password when prompted.  You can also do this in the psql command line interface by running ``create user --superuser <your username> with password '<your password>';``  You may have to become the postgres user in order to run that command.
3. Create a database called ``runestone_dev`` (or whatever you want to call it)  You do this by running ``createdb -O runestone runestone_dev``.  You can also do this in the psql command line interface by running ``create database runestone_dev owner runestone;``  You may have to become the postgres user in order to run that command.
4. Configure postgresql to listen on all ip addresses.  This is done by editing the ``postgresql.conf`` file and changing the ``listen_addresses`` to ``*``.  You can find this file by running ``pg_config --sysconfdir``.  On my mac it is ``/usr/local/var/postgres``.  You will need to restart postgresql for this to take effect.
5. Configure the pg_hba.conf file to allow access from the docker network.  This is done by adding a line like this to the file ``host all all 0.0.0.0/0 md5``.  You can find this file by running ``pg_config --sysconfdir``.  On my mac it is ``/usr/local/var/postgres``.  You will need to restart postgresql for this to take effect.
6. Restart Postgresql.  On my mac this is done by running ``brew services restart postgresql``.  On linux it is probably ``sudo service postgresql restart``



Authentication
--------------

At the time of this writing (April 2023) authentication is a bit over complicated.  That is part of what this monorepo project is trying to straighten out.

web2py has its own system for doing authentication that uses session tokens and encrypted session information stored as a python pickle in the database.

There are better ways including Javascript Web Token (JWTs) that modern frameworks use and share.   Right now we use both.  When you log in on the web2py server not only do you get a session cookie, but you also get a JWT.  All of the other services rely on that JWT.  We do like the role based authentication that we get from web2py so we want to keep that idea around, but eliminate the ``session`` and ``auth`` objects that web2py creates.

We are using the FastAPI_Login extension for much of what we do.  But JWTs are easy enough to check that it works with other non-FastAPI servers.


Running one or more servers
---------------------------

To run a project, for example the author server main web app:

.. code:: bash

   poetry shell
   uvicorn rsptx.author_server_api.main:app --reload

The top level docker-compose.yml file combines all of the projects

Each project has a Dockerfile for building an image. These images should
be push-able to our docker container registry and or the public docker
container registry

When developing and you need multiple servers running
=====================================================

Install nginx and configure projects/nginx/runestone.dev for your
system. You can run nginx in "non daemon mode" using
``nginx -g 'daemon off;'``

Set RUNESTONE_PATH -- not sure what for?? set SERVER_CONFIG development
set WEB2PY_CONFIG development set DEV_DBURL
postgresql://bmiller:@localhost/runestone_dev set BOOK_PATH
/path/to/books set WEB2PY_PRIVATE_KEY ??

.. code:: bash

   poetry shell

   uvicorn rsptx.book_server_api.main:app --reload --host 0.0.0.0 --port 8111
   cd ~/rs/bases/rsptx/web2py_server
   python web2py.py --no-gui --password whatever --ip 0.0.0.0 --port 8112

If startup fails you may be missing a dependency... poetry seems to miss
greenlet sometimes. But a quick check is to run python and then

.. code:: python

   >>> import rsptx.book_server_api.main

You will see a more detailed error message about what is missing.

At a minimum you will need to start web2py long enough for you to login
once.
