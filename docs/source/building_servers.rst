
Building and Running the Servers
===================================

You should have already:

#. :ref:`Cloned the source code<get-the-code>` (after forking it if you intend to contribute changes)

#. Set up Poetry.

#. Copied ``sample.env`` to ``.env`` and edited the file.

Now you are ready to install the required dependencies and build the servers:

4. Run ``poetry install --with=dev`` from the top level directory.  This will install all of the dependencies for the project.

#. When that completes run ``poetry shell`` to start a poetry shell.  You can verify that this worked correctly by running ``which rsmanage``.  You should see a path something like `/path/to/rs/.venv/bin/rsmanage`.  If you do not see this then you may need to run ``poetry shell`` again.

#. To leave the ``poetry`` shell, type ``exit``.

.. note::
   Future instructions will make it clear which commands need to be run inside the poetry virtual environment by always including ``poetry run ...`` at the start of the command. This is what you will need to type if you are **NOT** in the poetry shell. If you activate the ``poetry shell``, you will be able to skip typing ``poetry run``. For example, to check the environmental variables, you would type ``poetry run rsmanage env`` if the poetry shell is not active; if the shell is active, you would just type ``rsmanage env``.


7.  Run the ``build.py`` script from the ``rs`` folder by doing ``poetry run python ./build.py``. The first step of this script will verify that you have all of your environment variables defined. It will then build the python wheels for all the runestone components and then build the docker servers. This will take a while.


Starting the Servers
---------------------------------------

Check for local webserver
~~~~~~~~~~~~~~~~~~~~~~~~~

Before trying to run the servers, make sure you are not already running a webserver on your computer. Open a web browser and for the address type ``localhost``. If that fails to connect, you are good to go. If ``localhost`` does produce a web page, or some other error message, you should figure out what webserver is running and stop it. (Alternatively, you can edit the ``docker-compose.yml`` file and change the port that nginx is listening on to something other than 80. Port 80 is the default port for web sites to serve on.)

Test DB Connection and initialize
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If you are using the ``basic`` profile to install the database as part of the application you will want to start up and initialize the database first.  Run ``docker compose --profile basic up -d db``.  This will start up just the database server.  You can then initialize the database by running ``docker compose run rsmanage rsmanage initdb``.  Yes, I meant ``rsmanage rsmanage``.  This will create the database tables and add the initial data.  It will first check to see that it can connect to the database.  If not it will give you some information about your database connection url to help you diagnose the problem.

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
