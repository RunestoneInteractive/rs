
Building and Running the Servers 
===================================

You should have already:

#. :ref:`Cloned the source code<get-the-code>` (after forking it if you intend to contribute changes)

#. Set up Poetry.

#. Copied ``sample.env`` to ``.env`` and edited the file.

Now you are ready to install the required dependencies and build the servers:

4. Run ``poetry install --with=dev`` from the top level directory.  This will install all of the dependencies for the project.  

#. When that completes run ``poetry shell`` to start a poetry shell.  You can verify that this worked correctly by running ``rsmanage env``.  You should see a list of environment variables that are set.  If you do not see them then you may need to run ``poetry shell`` again.  If you get an error message that you cannot interpret you can ask for help in the ``#developer`` channel on the Runestone discord server.

#. To leave the ``poetry`` shell, type ``exit``.

.. note::
   Future instructions will make it clear which commands need to be run inside the poetry virtual environment by always including ``poetry run ...`` at the start of the command. This is what you will need to type if you are **NOT** in the poetry shell. If you activate the ``poetry shell``, you will be able to skip typing ``poetry run``. For example, to check the environmental variables, you would type ``poetry run rsmanage env`` if the poetry shell is not active; if the shell is active, you would just type ``rsmanage env``.


7.  Run the ``build.py`` script from the ``rs`` folder by doing ``poetry run python ./build.py``. The first step of this script will verify that you have all of your environment variables defined. It will then build the python wheels for all the runestone components and then build the docker servers. This will take a while.


Starting the Servers
---------------------------------------

Before trying to run the servers, make sure you are not already running a webserver on your computer. Open a web browser and for the address type ``localhost``. If that fails to connect, you are good to go. If ``localhost`` does produce a web page, or some other error message, you should figure out what webserver is running and stop it. (Alternatively, you can edit the ``docker-compose.yml`` file and change the port that nginx is listening on to something other than 80. Port 80 is the default port for web sites to serve on.)

If you are using the ``db.compose.yml`` file to install the database as part of the application you will want to start up and initialize the database first.  Run ``docker compose -f db.compose.yml up -d db``.  This will start up just the database server.  You can then initialize the database by running ``docker compose run rsmanage rsmanage initdb``.  Yes, I meant ``rsmanage rsmanage``.  This will create the database tables and add the initial data.

#. ou can start up the servers. To do this, you will use this (assuming you are letting docker run the database, and that you do not want the author server):

   ``docker compose -f docker-compose.yml -f db.compose.yml up``

   If you want the author server, it would be:

   ``docker compose -f docker-compose.yml -f author.compose.yml -f db.compose.yml up``

   If you are using your own database, leave out ``-f db.compose.yml``

   .. note::
      In the rest of these instructions you will see something like ``docker compose ... up``. ``...`` is a placeholder to indicate whatever list of compose files you are using (e.g. ``-f docker-compose.yml -f db.compose.yml``). Make sure to actually list the compose files instead of typing ``...``.

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

.. Initializing the DB
.. ---------------------------------------

.. 9. You need to make a database on the database server to hold data.

..    * If you are using the docker container-based database, simply do ``poetry run rsmanage initdb`` (While the container is running!). 
..      If you ever do ``docker compose ... stop`` you will need to redo this step after bringing the database back up.
..    * If you are using your own local database, create a database called ``runestone_dev``.  You do this by running ``createdb -O runestone runestone_dev``.  You can also do this in the psql command line interface by running ``create database runestone_dev owner runestone;``  You may have to become the postgres user in order to run that command.

Connecting to the Server
---------------------------------------

Now you should be able to connect to ``http://localhost/`` from your computer and see the homepage.
If you get 
