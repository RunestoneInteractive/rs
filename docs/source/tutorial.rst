Tutorial: Adding a new Service
==============================

Perhaps the best way to really understand the monorepo and how all of its pieces work is to walk through the process of adding a new service.  In this section we will walk through the entire process of adding a new server to the monorepo.  We will start with a new project and add a new base.  We will then build the project and run it in a docker container.  Finally we will run the project outside of the container.  We will create a library server that will allow us to display all of the books in the Runestone library.

First we will create a new project.  We will call it ``library_server``.  We will create a new base as well.  We will call it ``rsptx.library_server``.  We will create a new folder in the ``bases`` directory called ``rsptx.library_server``.  We will create a new folder in the ``projects`` directory called ``library_server``.

Here is a quick overview of what we are going to work on:

Prerequisites

* Install postgresql on your machine and make a username for yourself
* Clone the monorepo from github.com/RuneStoneInteractive/rs 
* Install uv
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

Creating a new project
----------------------

.. code-block:: bash

   uv run poly create base --name library_server
   uv run poly create project --name library_server
   cd projects/library_server
   uv add fastapi
   uv add uvicorn
   uv add sqlalchemy
   uv add psycopg2
   uv add jinja2
   uv add asyncpg
   uv add greenlet
   uv add python-dateutil
   uv add pyhumps
   uv add pydal

.. note::

   ``uv run poly create project`` will ask ``Do you want to add bricks to the
   library_server project?``. You can answer ``n`` and edit the
   ``[tool.polylith.bricks]`` section by hand as shown below.

``poly create`` already generates a ``[build-system]`` (hatchling +
``hatch-polylith-bricks``) and an empty ``[tool.polylith.bricks]`` section in the
project's ``pyproject.toml``. Fill that section in -- each entry maps a brick
source directory to its package path in the wheel (this replaces poetry's
``packages = []`` list), and the ``hatch-polylith-bricks`` build hook bundles
them:

.. code-block:: toml

   [tool.polylith.bricks]
   "../../components/rsptx/db" = "rsptx/db"
   "../../bases/rsptx/library_server" = "rsptx/library_server"

Now we can edit bases/rsptx/library_server/core.py

.. code-block:: python

   from fastapi import FastAPI

   app = FastAPI()

   @app.get("/")
   async def root():
      return {"message": "Hello World"}


Now we can run the server from the project folder:

.. code-block:: bash

   uv run uvicorn rsptx.library_server.core:app --reload --host 0.0.0.0 --port 8120


Now lets add some database work.  Lets get all of the books in the library and show them as a list. update core.py to look like this:

.. code-block:: python

   @app.get("/")
   async def root():
      res = await fetch_library_books()
      return {"books": res}


Now when you run the server you may get an error because you may not have all of your environment variables set up!  You can set them up in the ``.env`` file in the root of the monorepo.  You can also set them up in your shell.

Setting up the environment
--------------------------

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
   uv run rsmanage initdb


OK, now change back to the library_server project and run the server again.  You may see some books or you may not.  If you created a new database you will not see any books.  You can add books to the database by running the following from the root of the monorepo:

.. code-block:: bash

   uv run rsmanage addbookauthor
   uv run rsmanage build thinkcspy

Adding a Template
-----------------

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


We also need to update our pyproject.toml file to include the templates folder.  Add the templates brick to the ``[tool.polylith.bricks]`` section:

.. code-block:: toml

   [tool.polylith.bricks]
   "../../components/rsptx/db" = "rsptx/db"
   "../../bases/rsptx/library_server" = "rsptx/library_server"
   "../../components/rsptx/templates" = "rsptx/templates"


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
-----------------

Now lets build a docker image for our library server.  First we need to create a Dockerfile.  Create a new file called ``Dockerfile`` in the projects/library_server folder.  Add the following to the file:

.. code-block:: dockerfile

   # pull official base image
   FROM python:3.10-bullseye

   # This is the name of the wheel that we build using `uv build`
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

   uv build
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

This is because the response_helpers package is not installed in the docker image.  We can fix this by adding the missing bricks to the ``[tool.polylith.bricks]`` section of our pyproject.toml file:

.. code-block:: toml

   [tool.polylith.bricks]
   "../../components/rsptx/db" = "rsptx/db"
   "../../bases/rsptx/library_server" = "rsptx/library_server"
   "../../components/rsptx/templates" = "rsptx/templates"
   "../../components/rsptx/configuration" = "rsptx/configuration"
   "../../components/rsptx/logging" = "rsptx/logging"
   "../../components/rsptx/validation" = "rsptx/validation"
   "../../components/rsptx/response_helpers" = "rsptx/response_helpers"

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
  
