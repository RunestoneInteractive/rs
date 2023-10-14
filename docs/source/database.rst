.. _database-options:

Database Setup
=======================================

The database is a critical component as it is the glue that ties together the various servers.  You have a few different options for database setup.

1. Install Postgresql as part of the docker-compose setup (default). This requires the least manual work and keeps the database tightly tied to the rest of the docker images.
2. Install Postgresql on your local host (either natively or in a container). This allows you to use an existing database and to keep your database more insulated from the rest of the project (so that say test data persists through a rebuild of the other servers).


Install Postgresql with Docker
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If you do not want to install postgresql on your host, or maybe you are just looking to run an installation of Runestone for a couple of courses at your school, here is how to proceed.

1. Before you build the rest of the services run the command ``docker compose -f docker-compose.yml -f author.compose.yml -f db.compose.yml up -d db``  This will start just the database service in the set of composed services.   It will also use the default settings for ``POSTGRES_PASSWORD`` (runestone), ``POSTGRES_USER`` (runestone), and ``POSTGRES_DB`` (runestone_dev).  You should change these if you are running a production server, but if you are just getting set up for development for the first time just leave them alone.
2. Run ``docker compose run rsmanage rsmanage initdb`` This will build the image in docker for the rsmanage command and then run it to create the database and initialize it with the tables and data that you need.  You can use ``docker compose run rsmanage rsmanage ...`` to run any of the rsmanage commands in the composed app.   If you prefer you can install ``rsmanage`` on the host and run it there, but you will need to be mindful of your environment variables related to the database.
3. You will also need to have the minimal set of environment variables set up.  See the section below.  If you want to use the defaults you can set ``SERVER_CONFIG`` to ``development`` and ``DEV_DBURL`` to ``postgresql://runestone:runestone@localhost:2345/runestone_dev``  rsmanage will tell you if you are missing any environment variables.
4. You can run ``poetry install --with=dev`` from the top level directory to get a working virtual environment with the ``rsmanage`` command installed.  Run ``poetry shell`` to enable the newly created virtual environment.  Then try to run ``rsmanage`` You may get some errors about missing database libraries, this is normal, but you will have to read the error messages and install the dependencies if you want to run ``rsmanage`` directly.

At this point your database is ready.


Install Postgresql locally
~~~~~~~~~~~~~~~~~~~~~~~~~~

This is the option you will want for production use cases, and it gives you the most flexibility for development.  I simply installed postgresql on my mac using ``homebrew.`` Linux users can use ``apt`` or whatever.  You could even install it in its own `docker container <https://www.baeldung.com/ops/postgresql-docker-setup>`_ separate from the composed app and access it as if it was installed natively.  It is easy for services running in docker to access the database service running on the host.  Using  a URL like ``postgresql://user:pass@host.docker.internal/runestone_dev``  The key there is the ``host.docker.internal`` tells the process running in the container to connect to the host.  Running it on the host also makes it far less surprising when you do a rebuild and suddenly your test data is gone because you dumped the image.

You can connect to the database with one of 3 URLs depending on your server configuration (``SERVER_CONFIG``) environment variable - production, development, or test.  Test is really just for unit testing.  So you will most often want to use development.  The environment variables to set are ``DBURL``, ``DEV_DBURL`` or ``TEST_DBURL``.

If you install postgresql locally you will need to do  a few things to get it ready to go.  

1. Create a user called ``runestone`` with password ``runestone`` (or whatever you want to call it) This is done by running ``createuser -P runestone`` and entering the password when prompted.  You can also do this in the psql command line interface by running ``create user --superuser runestone with password 'runestone';``  You may have to become the postgres user in order to run that command.
2. You will also find it convenient to create a user for yourself.  This is done by running ``createuser -P <your username>`` and entering the password when prompted.  You can also do this in the psql command line interface by running ``create user --superuser <your username> with password '<your password>';``  You may have to become the postgres user in order to run that command.
3. Create a database called ``runestone_dev``  You do this by running ``createdb -O runestone runestone_dev``.  You can also do this in the psql command line interface by running ``create database runestone_dev owner runestone;``  You may have to become the postgres user in order to run that command.
4. Configure postgresql to listen on all ip addresses.  This is done by editing the ``postgresql.conf`` file and changing the ``listen_addresses`` to ``*``.  You may find the directory for this file by running ``pg_config --sysconfdir``.  On my mac it is ``/usr/local/var/postgres``.  On many linux varieties it is something like ``/etc/postgresql/14/main/`` Your path may be slightly different 14 in that example is the version of postgresql I am running. You will need to restart postgresql for this to take effect.
5. Configure the pg_hba.conf file to allow access from the docker network.  This is done by adding a line like this to the file ``host all all 0.0.0.0/0 md5``.  You can find this file by running ``pg_config --sysconfdir``.  On my mac it is ``/usr/local/var/postgres``. On many linux varieties it is something like ``/etc/postgresql/14/main/`` See above.   You will need to restart postgresql for this to take effect.
6. Restart Postgresql.  On my mac this is done by running ``brew services restart postgresql``.  On linux it is probably ``sudo service postgresql restart``
7. After you restart try the following command ``psql -h localhost -U runestone runestone_dev``  You should be prompted for a password.  Enter the password you created for the runestone user.  You should then be at a psql prompt.  You can exit by typing ``\q``  If you cannot connect then you have done something wrong.  You can ask for help in the ``developer-forum`` channel on the Runestone discord server.
8. Use the `rsmanage initdb` command to create the database schemas and populate some initial data for common courses, as well as create `testuser1` with password "xxx" yes three x's super secure.  You can change this password later.  You can also create your own user with the ``rsmanage adduser`` command.  You can also use the ``rsmanage resetpw`` command to change the password for testuser1.


Adding a Book
-------------

Now that you have done all the work to get your servers configured, you are also going to want one or more books for testing.  Lets add a book to your setup.

1. Go to your ``$BOOK_PATH`` folder and clone a book.  Lets take our simple overview book as an example. run the command ``git clone https://github.com/RunestoneInteractive.git``  You should see a new folder called ``overview``
2. The over view book is already in the database, so the only thing we need to do is build it.  ``cd overview`` and then run ``runestone build --all deploy``  If the command fails, make sure you have your virtual environment activated.  You can do this by running ``poetry shell`` from the top level directory.  

This builds the book and deploys it to ``overview/published/overview``  This is the location that the Runestone server will look for it.  Important:  The book name and the folder name must match.  So if you want to build a book called ``mybook`` then you need to clone it into a folder called ``mybook`` and then build it into ``mybook/published/mybook``.

The overview book is an easy example because the database already contains a course called overview by default.  Lets look at a more complicated scenario.  Lets say you want to build the active calculus book, and that you are going to want to use your server to support your department's calculus courses.

1. Clone the book into your ``$BOOK_PATH`` folder.  ``git clone https://github.com/active-calculus/active-calculus-single-mbx.git ac-single``
2. We need to add ac-single to the database of known courses with the rsmanage command.

.. code-block:: bash

   $ rsmanage addcourse
   Loaded .env file from /Users/bmiller/rs
   You have defined docker compose specific environment variables
   Using configuration: development
   Using database: runestone_dev
   Course Name: ac-single
   Base Course: ac-single
   Your institution: Runestone Academy
   Require users to log in [Y/n]: n
   Enable pair programming support [y/N]: n
   Course added to DB successfully
   $ 

3. Now we can build the book using the rsmanage command.  ``rsmanage build --ptx ac-single`` This will build the book and deploy it to ``ac-single/published/ac-single``  The Active Calculus book should now be visible in the library.
4. Notice that we used ``ac-single`` for the course name as well as the base course name.  You **should not** use this course for your own courses.  Instead you should use the runestone web interface to create a custom course from the ``ac-single`` base course.  But first you will need to make the book available to the web interface.  You do this but setting a flag in the library table of the database.  For now you need to do this by hand.  This really should be another rsmanage subcommand but instead run ``psql $DEV_DBURL``

.. code-block:: bash
   
      $ rsmanage library forclass --show

You can show the main library settings for any book with ``rsmanage library show document-id``  You can also hide/show books in the library with ``library visible --show/hide`` 

.. code-block:: bash

   rsmanage library show ac-single                                                                                       ─╯
   INFO - 2023-09-13 14:10:52,417 - Settings - Error path is /Users/bmiller/Runestone/books/tickets
   Loaded .env file
   You have defined docker compose specific environment variables
   Using configuration: development
   Using database: runestone_dev
   Title: Active Calculus
   Authors: Matt Boelkins
   shelf sections: Mathematics
   description: Active Calculus Single Variable supports an active learning approach in the first two semesters of calculus. Every section of Active Calculus Single Variable offers engaging activities for students to complete before and during class; additional exercises that challenge students to connect and assimilate core concepts; interactive WeBWorK exercises; opportunities for students to develop conceptual understanding and improve their skills at communicating mathematical idea.  The text is free and open-source, available in HTML, PDF, and print formats.  Ancillary materials for instructors are also available.
   -----------------
   for_classes: True
   is_visible: True

Now if you go to the create a course page Active Calculus will be a choice for you to use.


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


Adding a New Feature
--------------------

Most new features to Runestone take the form of a new API endpoint with or without a UX.  The UX is usually a new page in the web2py server.  The API endpoint is usually in the book_server_api or author_server_api.  A lot of the code for a new feature typically revolves around working with the database.  All servers in the monorepo share the same database.  The database is a postgresql database, and the model for the database resides in the ``rsptx.db.models`` module.  The elements of the module are defined using the ``sqlalchemy`` library.  In addition, most models have a corresponding validator provided by the Pydantic library.  In your code you should use these pydantic validators.  They ensure that your code is using the correct types.  They also provide a convenient way to convert the data from the database into a python dictionary.  The pydantic validators are defined in the ``rsptx.common.schemas`` module.

Finally, to create, retrieve, update or delete (crud) elements from the database you should use the ``rsptx.db.crud`` module.  This module provides a convenient way to interact with the database.  Most database actions are already there, so you just need to call the appropriate function.  If you need a new function, or expand the model to add a new table, we encourage you to write functions for the most common operations.    the ``crud`` module also provides a way to validate the data that you are trying to store in the database.  The ``crud`` module is used by the API endpoints and UX controllers to interact with the database.  You should NOT write database queries directly in your API endpoints.  Instead you should use the ``rsptx.db.crud`` module.

If your endpoint is going to be part of the book server, you should look at the routers in the ``rsptx.book_server_api.routers`` module.  If your endpoint is going to be part of the author server, you should look at the routers in the ``rsptx.author_server_api`` module.  


.. note:: web2py is deprecated 
   
      The web2py server is deprecated.  It is still used for the instructor interface, login/logout, practice. The API endpoints for interaction in a book have moved to the book server, we are currently moving the endpoints for assignments, peer instruction and practice to the assignment server.  After that we will develop a new server dedicated to managing authentication.  The new server will be a FastAPI server that will be used by the book server, author server, assignment server, etc.  The web2py server will be removed from the monorepo in the future.




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


A Tutorial to get you started
-----------------------------

In this section we will walk through the entire process of adding a new server to the monorepo.  We will start with a new project and add a new base.  We will then build the project and run it in a docker container.  Finally we will run the project outside of the container.  We will create a library server that will allow us to display all of the books in the Runestone library.

First we will create a new project.  We will call it ``library_server``.  We will create a new base as well.  We will call it ``rsptx.library``.  We will create a new folder in the ``bases`` directory called ``rsptx.library``.  We will create a new folder in the ``projects`` directory called ``library_server``.  

Here is a quick overview of what we are going to work on:

Prerequisites

* Install postgresql on your machine and make a username for yourself
* Clone the monorepo from github.com/RuneStoneInteractive/rs 
* Install poetry
* Install docker


Things we will do in this example:

1. Create a project
2. Create a base
3. Add the base to the project
4. Add fastapi and others to the project
5. Add database stuff to the project
6. in the bases folder create a simple fastapi app
7. Create a view function that returns a list of books
8. Create a template to render the list of books
9. Test it from the project folder
10. Build a docker image
11. Add the docker image to the docker-compose file


.. code-block:: bash

   poetry poly create base --name library_server
   poetry poly create project --name library_server
   cd projects/library_server
   poetry add fastapi
   poetry add uvicorn
   poetry add sqlalchemy
   poetry add psycopg2
   poetry add jinja2
   poetry add asyncpg
   poetry add greenlet
   poetry add python-dateutil
   poetry add pyhumps
   poetry add pydal

Also add look for ``packages = []`` in  ``pyproject.toml`` file and modify it to look like this:

.. code-block:: python

   packages = [
      {include = "rsptx/db", from = "../../components"},
      {include = "rsptx/library", from = "../../bases"},
   ]

Now we can edit bases/rsptx/library_server/core.py

.. code-block:: python

   from fastapi import FastAPI

   app = FastAPI()

   @app.get("/")
   async def root():
      return {"message": "Hello World"}


Now we can run the server from the project folder:

.. code-block:: bash

   poetry run uvicorn rsptx.library_server.core:app --reload --host 0.0.0.0 --port 8120


Now lets add some database work.  Lets get all of the books in the library and show them as a list. update core.py to look like this:

.. code-block:: python

   @app.get("/")
   async def root():
      res = await fetch_library_books()
      return {"books": res}


Now when you run the server you may get an error because you may not have all of your environment variables set up!  You can set them up in the ``.env`` file in the root of the monorepo.  You can also set them up in your shell.

Here is a minimal set of environment variables that you need to set:

.. code-block:: bash

   RUNESTONE_PATH = ~/path/to/rs
   RUNESTONE_HOST = localhost
   DEV_DBURL=postgresql://runestone:runestone@localhost/runestone_dev1
   SERVER_CONFIG=development
   JWT_SECRET=supersecret
   BOOK_PATH=/path/to/books
   WEB2PY_PRIVATE_KEY=sha512:24c4e0f1-df85-44cf-87b9-67fc714f5653


You may also get an error because your database may not have been initialized.  The easiest way to initialize the database is to use the rsmanage command.  You can do this by running the following from the projects/rsmanage folder

.. code-block:: bash

   createdb runestone_dev1
   poetry run rsmanage initdb


OK, now change back to the library_server project and run the server again.  You may see some books or you may not.  If you created a new database you will not see any books.  You can add books to the database by running the following from the root of the monorepo:

.. code-block:: bash

   poetry run rsmanage addbookauthor
   poetry run rsmanage build thinkcspy

Now lets create a template to render the list of books.  Create a new folder in the components/rsptx/ templates folder called library.  Then add a file called ``library.html`` to that folder.  Add the following to the file:

.. code-block:: html

   <body>
   <h1>Library</h1>
      <ul>
         {% for book in books %}
         <li>{{book.title}}</li>
         {% endfor %}
      </ul>
   </body>


We also need to update our pyproject.toml file to include the templates folder.  Add the following to the ``pyproject.toml`` file:

.. code-block:: python

   packages = [
      {include = "rsptx/db", from = "../../components"},
      {include = "rsptx/library", from = "../../bases"},
      {include = "rsptx/templates", from = "../../components"},
   ]


Next we have to tell Fastapi to use the template.  Add the following to the top of the core.py file:

.. code-block:: python

   from fastapi.templating import Jinja2Templates
   from fastapi.responses import HTMLResponse
   from rsptx.templates import template_folder

   templates = Jinja2Templates(directory=template_folder)

Now we can change the code in core.py to look like this:

.. code-block:: python

   from fastapi import FastAPI, Request
   from fastapi.templating import Jinja2Templates
   from fastapi.responses import HTMLResponse

   from rsptx.db.crud import fetch_library_books
   from rsptx.templates import template_folder

   app = FastAPI()

   templates = Jinja2Templates(directory=template_folder)

   @app.get("/", response_class=HTMLResponse)
   async def root(request: Request):
      res = await fetch_library_books()
      return templates.TemplateResponse(
         "library/library.html", {"request": request, "books": res}
      )

At this point you should be able to run the server and see a list of books.  You can run the server from the project folder. If you use the --reload option you can make changes to the code and see them reflected in the browser.  However

A good development tip is to use the ``--reload`` option when running the server.  This will allow you to make changes to the code and see them reflected in the browser.  However, if you are using the ``--reload`` option you will need to restart the server if you make changes to the ``pyproject.toml`` file.  By default uvicorn will only watch the folder you are running the server from.  You can change this by adding the ``--reload-dir`` option to the command line.  For example ``--reload --reload-dir=
../../components`` will watch the components folder for changes.  You can also use the ``reload-dir`` option multiple times to give it more folders to watch.

Can can find the fully working code for this example on the ``library_example`` branch of the runestone monorepo.

Setting up Docker
~~~~~~~~~~~~~~~~~

Now lets build a docker image for our library server.  First we need to create a Dockerfile.  Create a new file called ``Dockerfile`` in the projects/library_server folder.  Add the following to the file:

.. code-block:: dockerfile

   # pull official base image
   FROM python:3.10-bullseye

   # This is the name of the wheel that we build using `poetry build-project`
   ARG wheel=library_server-0.1.0-py3-none-any.whl

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



   CMD ["uvicorn", "rsptx.library_server.core:app", "--host", "0.0.0.0", "--port", "8000"]

To build the docker image you need to build the wheel for the library_server project.  You can do this by running the following from the library_server project folder:

.. code-block:: bash

   poetry build-project
   docker build -t library .

You can run the docker image by running the following:

.. code-block:: bash

   docker run -p 8000:8000 library

When you run the docker image you will see the following output:

.. code-block:: bash

   File "/usr/local/lib/python3.10/site-packages/rsptx/db/__init__.py", line 4, in <module>
      from rsptx.db import crud
   File "/usr/local/lib/python3.10/site-packages/rsptx/db/crud.py", line 39, in <module>
      from rsptx.response_helpers.core import http_422error_detail
   ModuleNotFoundError: No module named 'rsptx.response_helpers'

This is because the response_helpers package is not installed in the docker image.  We can fix this by updating the packates in our pyproject.toml file:

.. code-block:: python

   packages = [
      { include = "rsptx/db", from="../../components"},
      { include = "rsptx/library_server",  from="../../bases"},
      { include = "rsptx/templates", from = "../../components" },
      { include = "rsptx/configuration", from = "../../components"},
      { include = "rsptx/logging", from = "../../components"},
      { include = "rsptx/validation", from = "../../components"},
      { include = "rsptx/response_helpers", from = "../../components"},
   ]

It would be nice if we could make all of the components completely independent, but there are naturally some dependencies between them.  In early development the structure of the monorepo makes it pretty easy to forget to add these dependencies to the pyproject.toml file.  Building the docker image will expose all of these. So you may just have rebuild a few times until you get it right.

Finally lets look at our docker-compose.yml file.  We need to add a new service for the library_server.  Add the following to the docker-compose.yml file in the root of the monorepo.

.. code-block:: yaml

   library:
      build:
         context: ./projects/library_server
         dockerfile: Dockerfile
      image: library
      extra_hosts:
        - host.docker.internal:host-gateway
      container_name: library
      restart: unless-stopped
      ports:
         - "8000:8000"
      volumes:
        - ${BOOK_PATH}:/usr/books

      environment:
         - BOOK_PATH=/usr/books
         - SERVER_CONFIG=${SERVER_CONFIG}
         - RUNESTONE_PATH=/usr/src/app
         - REDIS_URI=redis://redis:6379/0
         # Note: host.docker.internal refers back to the host so we can just use a local instance
         # of postgresql
         - DEV_DBURL postgresql://runestone:runestone@host.docker.internal/runestone_dev
         - DOCKER_COMPOSE=1

You can now run the library server along with everything else by running the following from the root of the monorepo:

.. code-block:: bash

   docker-compose up

.. note:: 

   * The ``extra_hosts`` section is needed to allow the docker container to connect to the host machine.  This is needed because the library server needs to connect to the postgresql database on the host machine.
   * The ``volumes`` section is needed to mount the books folder on the host machine into the docker container.  This is needed because the library server needs to access the books folder on the host machine.

To integrate the library server with everything else we would want to give it a prefix url of ``/library`` Then we would update the configuration for our nginx front end to proxy requests to the library server.  


Other References
----------------

* Docker Compose `documentation <https://docs.docker.com/compose/compose-file/compose-file-v3/>`_
* Nginx `documentation <https://nginx.org/en/docs/>`_
  
