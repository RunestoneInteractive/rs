Adding a New Feature Server Side
--------------------------------

Most new features to Runestone take the form of a new API endpoint with or without a UX.  The UX is usually a new page in the web2py server.  The API endpoint is usually in the book_server_api or author_server_api.  A lot of the code for a new feature typically revolves around working with the database.  All servers in the monorepo share the same database.  The database is a postgresql database, and the model for the database resides in the ``rsptx.db.models`` module.  The elements of the module are defined using the ``sqlalchemy`` library.  In addition, most models have a corresponding validator provided by the Pydantic library.  In your code you should use these pydantic validators.  They ensure that your code is using the correct types.  They also provide a convenient way to convert the data from the database into a python dictionary.  The pydantic validators are defined in the ``rsptx.common.schemas`` module.

Finally, to create, retrieve, update or delete (crud) elements from the database you should use the ``rsptx.db.crud`` module.  This module provides a convenient way to interact with the database.  Most database actions are already there, so you just need to call the appropriate function.  If you need a new function, or expand the model to add a new table, we encourage you to write functions for the most common operations.    the ``crud`` module also provides a way to validate the data that you are trying to store in the database.  The ``crud`` module is used by the API endpoints and UX controllers to interact with the database.  You should NOT write database queries directly in your API endpoints.  Instead you should use the ``rsptx.db.crud`` module.

If your endpoint is going to be part of the book server, you should look at the routers in the ``rsptx.book_server_api.routers`` module.  If your endpoint is going to be part of the author server, you should look at the routers in the ``rsptx.author_server_api`` module. If your endpoint is going to be part of the assignment server you should look at the routers in the ``rsptx.assignment_server_api``.


.. note:: web2py is deprecated

      The web2py server is deprecated.  It is still used for the instructor interface, login/logout, practice. The API endpoints for interaction in a book have moved to the book server, we are currently moving the endpoints for assignments, peer instruction and practice to the assignment server.  After that we will develop a new server dedicated to managing authentication.  The new server will be a FastAPI server that will be used by the book server, author server, assignment server, etc.  The web2py server will be removed from the monorepo in the future.

Single Endpoint Fast Turnaround Development
-------------------------------------------

It can be time consuming to rebuild a docker container every time you want to test a change.  Most often these changes involve interacting with a single server endpoint.  To speed up development you can run the server locally and interact with it directly.  This is especially useful when you are developing a new API endpoint.  To do this you can use the ``dstart`` script to start a single service on the host, rather than in a container.  For example, to start the book server on the host you can run ``dstart book`` this will start the book server on port 8100.  You can access any of the book server endpoints by entering the URL into the address bar of your browser.  If you make a change to the **python** code or to the **template** for a page, you will see the changes as soon as you refresh the page.

.. note:: dstart is for developing on ONE service at a time

      The ``dstart`` script is not for production.  It is only for development.  It is not secure, and it is designed to let you interact with one service at a time.  It does not redirect you to other services.   So for example if you ``dstart runestone`` and try to go to a course it will fail.  But if you ``dstart runestone`` and want to work on the course page by just reloading, it will work great and will be much faster than rebuilding the container.


You will need to make sure that you have some of your host side environment variables defined correctly.  Mainly the ``RUNESTONE_PATH`` which should point to your ``rs`` folder.  And ``DEV_DBURL`` which should point to your local database. If you configured the database to run inside docker then it should be something like ``postgresql://runestone:r
unestone@localhost:2345/runestone_dev``. Whereas your ``DC_DEV_DBURL`` will reference the ``db`` service rather than localhost.  Note that internally postgresql runs on port 5432.  We expose it on 2345 so that if you also have postgresql running on your host it won't conflict.


.. note:: web2py does not see changes in modules

      The web2py server will notice changes made in the controllers, models, and views folders.  But does not see changes in the modules folder.  You will simply need to restart ``dstart`` to see changes in the modules folder.


Static Assets
-------------

One important note about static assets.  That is things found in ``components/rsptx/templates/staticAssets`` for performance reasons when docker is running we serve those files **directly** from the nginx server.  So if you are working on those files you will need to rebuild/restart nginx to see the changes.  That is quite fast.  ``./build --one nginx --restart``


Showing Dates and Times on a Page
---------------------------------

Datetimes are stored in the database as **naive UTC** -- that includes
``assignments.duedate``, which used to be stored in course-local wall clock
time and was converted by migration ``c4e8a1f7b2d9``.  Never render one
directly with ``strftime`` or ``{{ value }}``: the reader would see UTC and
silently mis-read a deadline.

Use the ``course_datetime_tag()`` Jinja global instead::

    {{ course_datetime_tag(assignment.duedate, course.timezone) }}

It emits a ``<time>`` element carrying the instant in UTC, with the
course-local time as the visible text and in the ``title``.  A companion
script rewrites the text into **the viewer's own timezone**, so a student
enrolled from another timezone -- or simply travelling -- never has to do the
conversion themselves under time pressure.  The course time stays in the
tooltip so a student comparing notes with a classmate can still see the frame
the course itself uses.  Pass ``style="short"`` for a compact
``YYYY-MM-DD HH:MM`` rendering, and ``empty="N/A"`` for the text to use when
the value is ``None``.

.. warning:: Every page using ``course_datetime_tag()`` must include the
   localize script itself

   ::

       {% include 'common/localize_times.html' %}

   Put it in the page's ``js`` block, not in ``_base.html``.  PreTeXt books
   ship their own ``_base.html``, and ``get_jinja_templates()`` puts the book
   directory ahead of the shared template folder in its ``ChoiceLoader``, so a
   base-template include silently disappears for exactly those courses.  The
   failure is quiet and easy to miss: the page still renders, but every time
   is left showing course-local time instead of the reader's, which looks
   plausible until a reader in another timezone reads it.

If you need a plain string rather than a ``<time>`` element -- for a CSV
export, an email, or a log line, where there is no browser to localize it --
use ``format_course_datetime()`` from ``rsptx.templates.core``, which renders
the course-local wall clock time directly.  A course with no timezone set is
treated as UTC, matching the migration; an unrecognized timezone name falls
back to UTC rather than raising, so a bad value cannot take a page down.


