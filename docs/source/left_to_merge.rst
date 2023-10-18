.. _database-options:

MERGE ME
=======================================



Getting a Server Started 
------------------------

This assumes that you have already followed the instructions for installing postgresql, poetry and the plugins as well as Docker.

1. copy ``sample.env`` to ``.env`` and edit the file.
2. Run ``poetry install --with=dev`` from the top level directory.  This will install all of the dependencies for the project.  When that completes run ``poetry shell`` to start a poetry shell.  You can verify that this worked correctly by running ``rsmanage env``.  You should see a list of environment variables that are set.  If you do not see them then you may need to run ``poetry shell`` again.  If you get an error message that you cannot interpret you can ask for help in the ``#developer`` channel on the Runestone discord server.
3.  Create a new database for your class or book.  You can do this by running ``createdb -O runestone <dbname>``.  You can also do this in the psql command line interface by running ``create database <dbname> owner runestone;``  You may have to become the postgres user in order to run that command.  If you have already created a database you can skip this one.
4.  From the ``bases/rsptx/interactives`` folder run ``npm install``.  This will install all of the javascript dependencies for the interactives.  Next run ``npm run build`` this will build the Runestone Interactive javascript files.  You will need to do this every time you make a change to the javascript files.  If you are NOT going to build a book, then you can skip this step.
5.  Run the ``build.py`` script from the ``rs`` folder. The first step of this script will verify that you have all of your environment variables defined.
6.  Make sure you are not already running a webserver on your computer.  You can check this by running ``lsof -i :80``.  If you see a line that says ``nginx`` then you are already running a webserver.  You can stop it by running ``sudo nginx -s stop``.  Alternatively you can edit the ``docker-compose.yml`` file and change the port that nginx is listening on to something other than 80.
7.  Run ``docker-compose up`` from the ``rs`` folder.  This will start up all of the except the author and worker. Those are only needed in a production environment where you want to give authors the ability to build and deploy their own books. If you want to start up **everything** you run ``docker compose -f docker-compose.yml -f author.compose.yml`` You can also run ``docker-compose up <server name>`` to start up just one server.  The server names are ``runestone``, ``book``, ``author``, ``dash``, ``assignment``, ``worker``, and ``nginx``.  You can also run ``docker-compose up -d`` to run the servers in the background.
8.  Now you should be able to connect to ``http://localhost/`` from your computer and see the homepage.


Authentication
~~~~~~~~~~~~~~

At the time of this writing (April 2023) authentication is a bit over complicated.  That is part of what this monorepo project is trying to straighten out.

web2py has its own system for doing authentication that uses session tokens and encrypted session information stored as a python pickle in the database.

There are better ways including Javascript Web Token (JWTs) that modern frameworks use and share.   Right now we use both.  When you log in on the web2py server not only do you get a session cookie, but you also get a JWT.  All of the other services rely on that JWT.  We do like the role based authentication that we get from web2py so we want to keep that idea around, but eliminate the ``session`` and ``auth`` objects that web2py creates.

We are using the FastAPI_Login extension for much of what we do.  But JWTs are easy enough to check that it works with other non-FastAPI servers.


Running one or more servers
~~~~~~~~~~~~~~~~~~~~~~~~~~~

To run a project, for example the author server main web app:

.. code:: bash

   poetry shell
   uvicorn rsptx.author_server_api.main:app --reload

Better yet, I have added a simple script called ``dstart`` just give it the name of the service you want to run and it will start it up for you.  It is also a simple place to look if you want to see the command to start up a particular server.

Each project has a Dockerfile for building an image. These images should
be push-able to our docker container registry and or the public docker
container registry

To build all of the docker containers and bring them up together.  You can run the ``build.py`` script in the top level directory. The dependencies for the build.py script are included in the top level ``pyproject.toml`` file.  ``poetry install --with=dev`` will install everything you need and then you may will want to start up a poetry shell. The ``build.py`` script will build all of the Python wheels and Docker images, when that completes run ``docker-compose up``.  You can also run ``docker-compose up`` directly if you have already built the images.  

.. code-block:: bash

   poetry run ./build.py --help
   Checking your environment
   Usage: build.py [--verbose] [--help] [--all] [--push] [--one <container>] [--restart]  
         --all build all containers, including author and worker
         --push push all containers to docker hub
         --one <container> build just one container, e.g. --one author
         --restart restart the container(s) after building
         --help print this message
         --verbose print more information about what is happening

The ``build.py`` script will build one or all of the Python wheels and Docker images, when that completes it will stop and run ``docker-compose up -d``. to restart one or more images.  It will also do a minimal check of your environment variables to make sure you have the ones you need.  It will not check to see if they are correct.  If you are missing any that are required for the build.py script to run it will tell you which ones are missing and then stop.


When developing and you need multiple servers running


Install nginx and configure projects/nginx/runestone.dev for your
system. You can run nginx in "non daemon mode" using
``nginx -g 'daemon off;'``

* Set ``RUNESTONE_PATH`` -- to be the root of the rs repo - this is used for some utilities to read the ``.env`` file.
* set ``WEB2PY_CONFIG`` development 
* set ``DEV_DBURL`` postgresql://bmiller:@localhost/runestone_dev 
* set ``BOOK_PATH`` /path/to/books 
* set ``WEB2PY_PRIVATE_KEY`` for logging in

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

logging
~~~~~~~

By default we have logging set to DEBUG for all of the servers.  This is probably not what you want in production.   You can change the logging level for the runestone server by modifying the ``GUNICORN_CMD_ARGS` environment variable and adding ``--log-level 'warning'`` to the end of the string. the other servers can be configured by setting the ``LOG_LEVEL`` environment variable to ``warning``.








Adding a new Project
--------------------

To add a new project to the monorepo, you will need to add a new folder in the ``bases`` directory.  The folder should be named ``rsptx.<project_name>``. You can do this with ``poetry poly create base --name <yourname>``  You will also need to add a new folder under ``projects/<project_name>``  You can create this with ``poetry poly create project --name <yourname>`` The folder will contain a ``pyproject.toml`` file.  

From the project folder you can do ``poetry add xxxx`` to add packages to your project.  To use any of the packages in your project you will need to add the following to the ``pyproject.toml`` file.  You will find the line ``packages = []`` To that list you will add the various ``rsptx.xxx`` modules from the various components, for example ``{include = "rsptx/db", from = "../../components"},``  You will also want to add your base module to the list of packages.  For example ``{include = "rsptx/<project_name>", from = "../../bases"},``  To build your new project you run ``poetry build-project`` from the project folder.  This will create a ``dist`` folder in the project folder.  The dist folder will contain a source distribution as well as a python wheel.

If the new project is going to be a FastAPI web server then you will need to write a Dockerfile to build an image using the wheel, and any other components.  For example the Dockerfile for the assignment server looks like this:

.. code-block:: Dockerfile

   FROM python:3.10-bullseye

   # This is the name of the wheel that we build using `poetry build-project`
   ARG wheel=assignment_server-0.1.0-py3-none-any.whl

   # set work directory
   WORKDIR /usr/src/app

   # set environment variables
   ENV PYTHONDONTWRITEBYTECODE 1
   ENV PYTHONUNBUFFERED 1
   ENV RUNESTONE_PATH /usr/src/app
   # When docker is run the books volume can/will be mounted
   ENV BOOK_PATH /usr/books
   ENV SERVER_CONFIG development
   # Note: host.docker.internal refers back to the host so we can just use a local instance
   # of postgresql
   ENV DEV_DBURL postgresql://runestone:runestone@host.docker.internal/runestone_dev
   ENV CELERY_BROKER_URL=redis://redis:6379/0
   ENV CELERY_RESULT_BACKEND=redis://redis:6379/0

   # install dependencies
   RUN pip install --upgrade pip
   RUN apt update


   # copy project
   COPY ./dist/$wheel /usr/src/app/$wheel
   # When you pip install a wheel it also installs all of the dependencies
   # which are stored in the METADATA file inside the wheel
   RUN pip install --no-cache-dir --upgrade /usr/src/app/$wheel

   CMD ["uvicorn", "rsptx.assignment_server_api.core:app", "--host", "0.0.0.0", "--port", "8000"]

You can build the image on your own and run it locally, or you can use the ``docker-compose`` file in the root of the monorepo to build and run the image.  The ``docker-compose`` file will build the image and run it.  It will also start up a postgresql database and a redis server.  The ``docker-compose`` file will also mount the ``bases`` and ``projects`` folders in the monorepo into the image.  This means that you can make changes to the code in the monorepo and they will be reflected in the running image.  You can also run the image locally and mount a local folder containing a book.  This will allow you to test your new project against a local book.  For example, to run the assignment server locally you would do the following:

.. code-block:: bash

   docker run auth_server -v /your/home/books:/usr/books

When doing development it is often much more convenient to just run the server outside of the container.  If you have the poetry shell activated you can do the following:

.. code-block:: bash

   cd projects/assignment_server
   poetry run uvicorn rsptx.assignment_server_api.core:app --host

All of the servers use an authentication token stored in a cookie.  You may need to start up the web2py server to get a cookie.  You can do this by running the following from the root of the monorepo:

.. code-block:: bash

   poetry run gunicorn --bind 0.0.0.0:8080 --workers 1 rsptx.web2py_server.wsgihandler:application



This will start up the web2py server and create an admin user with the password you specify.  You can then login to the web2py server and create a cookie.  You can then use that cookie to access the other servers.  You can also use the web2py server to create a course and add users to the course.  This will allow you to test the other servers with a real course.


