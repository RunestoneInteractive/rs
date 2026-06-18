.. _building-servers:

Building and Running the Servers
===================================

You should have already:

#. :ref:`Cloned the source code<get-the-code>` (after forking it if you intend to contribute changes)

#. Set up uv.

#. Copied ``sample.env`` to ``.env`` and edited the file -- make sure ``BOOK_PATH`` is set.

Now you are ready to install the required dependencies and build the servers:

4. Run ``uv sync`` from the top level directory.  This will install all of the dependencies for the project.

#. When that completes activate the virtual environment with ``source .venv/bin/activate``.  You can verify that this worked correctly by running ``which rsmanage``.  You should see a path something like `/path/to/rs/.venv/bin/rsmanage`.  If you do not see this then you may need to run ``uv sync`` and activate again.

#. To leave the virtual environment, type ``deactivate``.

.. note::
   Future instructions will make it clear which commands need to be run inside the virtual environment by always including ``uv run ...`` at the start of the command. This is what you will need to type if you are **NOT** in the activated virtual environment. If you activate the virtual environment, you will be able to skip typing ``uv run``. For example, to check the environmental variables, you would type ``uv run rsmanage env`` if the virtual environment is not active; if the virtual environment is active, you would just type ``rsmanage env``.


7.  Run the ``build`` script from the ``rs`` folder by doing ``build full``. The first step of this script will verify that you have all of your environment variables defined. It will then build the python wheels for all the runestone components and then build the docker servers. This will take a while.


Starting the Servers
---------------------------------------

Check for local webserver
~~~~~~~~~~~~~~~~~~~~~~~~~

Before trying to run the servers, make sure you are not already running a webserver on your computer. Open a web browser and for the address type ``localhost``. If that fails to connect, you are good to go. If ``localhost`` does produce a web page, or some other error message, you should figure out what webserver is running and stop it. (Alternatively, you can edit the ``docker-compose.yml`` file and change the port that nginx is listening on to something other than 80. Port 80 is the default port for web sites to serve on.)

Test DB Connection and initialize
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If you are using the ``basic`` profile to install the database as part of the application you will want to start up and initialize the database first.  Run ``docker compose --profile basic up -d db``.  This will start up just the database server.  You can then initialize the database by running ``docker compose run rsmanage rsmanage initdb``.  Yes, I meant ``rsmanage rsmanage``.  This will create the database tables and add the initial data.  It will first check to see that it can connect to the database.  If not it will give you some information about your database connection url to help you diagnose the problem.

Once the initdb command completes run ``alembic stamp head`` to mark the current state of the database.  This will allow you to run migrations in the future to ensure that your database schema is up to date.

At this point you can also check your environment variables by running `rsmanage env` and/or `docker compose run rsmanage rsmanage env`.  If you have set up separate `DEV_DBURL` and `DC_DEV_DBURL` environment variables both should work.

Start the Servers
~~~~~~~~~~~~~~~~~~

#. Now, you can start up the servers. To do this, you will use this (assuming you are letting docker run the database, and that you do not want the author server):

   ``docker compose --profile basic up``

   If you want the author server, it would be:

   ``docker compose --profile author --profile basic up`` or
   ``COMPOSE_PROFILES=author,basic docker compose up``

   If you are using your own database, leave out ``--profile basic`` and/or edit the ``COMPOSE_PROFILES`` variable in your ``.env`` file to remove ``basic``.

   .. note::
      In the rest of these instructions you will see something like ``docker compose ... up``. ``...`` is a placeholder to indicate whatever list of compose files you are using (e.g. ``-f docker-compose.yml``). Make sure to actually list the compose files instead of typing ``...``.

   This will take over the current shell to run the docker containers. The advantage of letting docker take over the shell is that you will get logging messages printed to that window. You can stop the servers by doing ``Ctrl-C``. To run new commands while the containers are running, simply start up an additional shell.

   If you add ``-d`` at the end of the ``docker compose ... up`` command, the containers will run in the background. If you do so, you will have to stop the containers using ``docker compose ... stop``. See below.


Using Docker to Manage Containers
---------------------------------------

To check what containers are currently running, do ``docker ps``. Try that now.

To stop all of the containers, use ``docker compose ... stop``, making sure the list of compose files you use in place of ``...`` is the same as the list you used to start the servers.

To restart the servers, simply rerun ``docker compose ... start``.

To stop the servers and destroy the containers they are running in, use ``docker compose ... stop``. This will destroy the virtual machines and any data stored on the machines - including data stored in the database if it is being run in a container.

To start them back up after using ``docker compose ...stop``, you will have to use ``docker compose ... up``. Doing this will rebuild all the containers (but should use cached versions of the images that were already built and thus be faster than the original build.)

.. note::
   If you are running your database in a docker container and ever need to reset it, ``docker compose ... stop`` followed by ``docker compose ... up`` will do so. After resetting the database, you will need to reinitialize it (see below) and re-add any books and users you have created.


Connecting to the Server
---------------------------------------

Now you should be able to connect to ``http://localhost/`` from your computer and see the homepage.
If you get an error check the :ref:`Troubleshooting <debugging>` section.

Using the ``build`` script
----------------------------

The `build` script is a convenience script that will build the docker images for the runestone servers.  It will also build the python wheels for all of the runestone components.  This script is run from the top level directory of the rs repo.  It will check to see if you have all of the required environment variables defined and then build the docker images.  It is very useful, but not all knowing.  If there are ways to make it smarter, or to find cases where it fails, or to make it detect mis-configurations, please let us know by filing an issue on the `github repo <https://github.com/RunestoneInteractive/rs/issues>`_.

.. note::

   You either have to be in the activated virtual environment or run the script with ``uv run build ...``.

There are several options that you can pass to the script.  You can see them by running ``build --help``.  The output of the help option is shown below:

.. code-block::

   Usage: build [OPTIONS] COMMAND1 [ARGS]... [COMMAND2 [ARGS]...]...

   Build the wheels and Docker containers needed for this application build
   wheel image restart build wheel image push build --service author --service
   worker wheel image restart build push -- push the built images to the
   registry

   Options:
   --verbose           Show more output
   --all               Build all containers, including author and worker
   --core              Build only the core services  [default: True]
   -s, --service TEXT  Build one service - multiple ok
   --clean             Remove all containers and images before starting
   --help              Show this message and exit.

   Commands:
   checkdb  Check the database and run migrations
   env      Check key environment variables and exit
   full     Build the wheels, images, and restart the services
   image    Build the docker images
   list     List the services and last build
   push     Push the images to Docker Hub
   restart  Restart the runestone docker services
   wheel    Build the python wheels


If something in the build does not work or you have questions about setup or environment
variables or installation, please check out our developer documentation.
https://runestone-monorepo.readthedocs.io/en/latest/developing.html

Here is a bit more detail on how the script operates so you know what to expect:

#. Load the ``.env`` file.

#. Check common environment variables to make sure they are defined.  If they are not defined the script will exit with an error message.  If you pass the ``--verbose`` option it will print out the values of the environment variables that it checks.

#. If you pass the ``--clean`` option it will remove all of the containers and images before starting.  This is useful if you are having trouble with the containers and want to start fresh.

#. Build the python wheels for all of the runestone components.  This is done by running ``uv build`` in each of the project directories.  This will create a wheel file in the ``dist`` directory of each project.  If there is a ``build.py`` file in the project folder it will be run before the wheel is built.  This is useful for projects that need to build some assets before the wheel is built. such as the interactives or the assignment projects.

#. Build the docker images for the runestone servers.  This is done by running ``docker compose build``.  This will build the images for the runestone servers.  If you pass the ``--all`` option it will also build the images for the author and worker servers.  If you pass one or more ``--service <service>`` option(s) it will build for the services you specify.

#. Push the images to the container registry if the ``push`` subcommand is passed.  The container registry is configured in the docker-compose.yml file.  Unless you are authorized to do so, you should not use this option.  It will fail if you do not have the correct permissions.

#. Check the database for possible migrations.  If there are migrations that need to be run it will print out a message telling you how to run them.  You can run the migrations by running ``alembic upgrade head``.  This will run all of the migrations that have not yet been run. **Note:** It is important that the first time you clone `rs` or if you pull from the repo and start over with your database then you should run the ``alembic stamp head`` command to let alembic know that you are starting from a clean slate. The ``build checkdb`` command can detect this and will tell you. This will allow you to run migrations successfully in the future.  If you see that you are trying to add columns  or tables that are already there, then you are out of sync with alembic and will need to figure out where you are and run ``alembic stamp <revision>`` to get back in sync.  You can find the various revisions by looking in the ``migrations/versions`` directory.

#. if you run the ``restart`` subcommand it will restart the containers after building the images.  This is useful if you are making changes to the runestone code and want to see the changes reflected in the running containers.

If a **wheel fails to build** then look at the ``build.log`` file in the appropriate project folder.  If an **image fails to build** look at the ``build.log`` file in the main folder.  If it seems like the author service is taking a long time to build, it is because it is installing a full version of LaTeX and that just takes time!


Keeping the Servers Up to Date
---------------------------------------

To keep the servers up to date with the latest changes in the codebase, you will need to pull the latest changes from the repo and rebuild the servers.  To do this you will need to run the following commands:
The repository is under active development.  It is a really good idea to keep your local copy up to date.  You don't need to do this daily, but I would recommend weekly.  To do this you will need to:

#. Pull the latest changes from the repo by running ``git pull``.
#. Run ``uv sync`` to install any new dependencies.
#. Activate the virtual environment with ``source .venv/bin/activate``.
#. Run ``build full`` to rebuild the servers, and check the database.
#. Run ``docker compose stop`` to start the servers.
#. Run ``docker compose up -d`` to start the servers.

If  you find that your database is horribly out of date, and running ``alembic upgrade head`` fails. You can run ``docker compose down db`` the down subcommand will  **remove** the database container and then run ``docker compose up -d db`` to start a fresh database.  You will then need to run ``docker compose run rsmanage rsmanage initdb`` to initialize the database.  This will create the tables and add the initial data.  You will then need to run ``alembic stamp head`` to mark the current state of the database.  This will allow you to run migrations in the future to ensure that your database schema is up to date.

.. _releasing-compose-changes:

Releasing a docker-compose.yml change to end users
---------------------------------------------------------

End users run the composed application from a ``docker-compose.yml`` file they
downloaded (via ``init_runestone.sh``); they update their images with
``docker compose pull`` and update the file itself with
``./init_runestone.sh update``. The problem is that a new image sometimes
*expects* changes in ``docker-compose.yml``, and a user who only pulls images
can end up with a file that is out of sync with the images.

To guard against that, the stack carries a **compose schema version**:

- ``docker-compose.yml`` declares the version it provides via
  ``COMPOSE_SCHEMA_VERSION`` in the ``preflight`` service.
- The ``rs-book`` image bakes in the minimum version it requires via
  ``REQUIRED_COMPOSE_SCHEMA_VERSION`` (see
  ``projects/book_server/Dockerfile``).
- A ``preflight`` service (which every long-running service depends on) runs
  ``check_compose_version.sh`` at startup and refuses to bring the stack up,
  with an actionable message, if the file's version is older than the image
  requires.

When you change ``docker-compose.yml`` you must decide whether the change is
**breaking** (newer images cannot work with the old file) or
**backward-compatible** (old images do not care).

If the change is one users *must* adopt (breaking)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Do all of these together:

#. Edit ``docker-compose.yml`` as needed.
#. Bump the file's schema version in the ``preflight`` service, e.g.
   ``COMPOSE_SCHEMA_VERSION=2`` (was ``1``).
#. Bump the image's required version to match in
   ``projects/book_server/Dockerfile``:
   ``ENV REQUIRED_COMPOSE_SCHEMA_VERSION=2``. Keep these two numbers in
   lockstep -- the invariant is that a matching file provides ``N`` and the
   image requires ``N``, so any older file (``< N``) is rejected.
#. Rebuild and publish the images, **always including** ``rs-book`` (the
   preflight check -- ``check_compose_version.sh`` and
   ``REQUIRED_COMPOSE_SCHEMA_VERSION`` -- lives in that image), plus any other
   images that actually need the change. The ``preflight`` service has no image
   of its own; it reuses ``rs-book``, so there is nothing extra to add to
   ``docker-bake.hcl``. Republish ``rs-book`` with:

   .. code-block:: bash

      docker buildx bake --file docker-bake.hcl rs-book --push
#. Commit and push the new ``docker-compose.yml`` to ``main`` -- that is where
   ``init_runestone.sh update`` fetches it from.

**Ordering matters:** make sure the new ``docker-compose.yml`` is on ``main``
before (or at the same time as) you publish the new images. Otherwise a user
who pulls the new image (requires ``2``) but whose ``update`` fetches a
not-yet-updated file (still provides ``1``) is blocked with no working fix.

The user experience is then: ``docker compose pull`` gets an image requiring
the new version, the next ``docker compose up`` fails the preflight check with
a message telling them to run ``./init_runestone.sh update``, and that command
fetches the matching file, pulls images, restarts, and migrates.

If the change is backward-compatible
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

For cosmetic edits, comments, or additive ``${VAR:-default}`` options that old
images simply ignore, just edit ``docker-compose.yml`` and push to ``main``.
**Do not** bump the schema numbers, or you will force-block every user for a
change that does not require it. They pick it up on their next
``./init_runestone.sh update`` without being forced.

New ``.env`` variables are not covered by this
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The schema version validates the *structure* of ``docker-compose.yml``, not the
contents of ``.env`` (which is user-owned and never overwritten -- only
``sample.env`` is refreshed by ``update``). If your change needs a new
variable, give it a safe default in compose (``${NEW_VAR:-default}``) so
existing ``.env`` files keep working, and add it to ``sample.env`` with
documentation.
