Adding a Book
-------------

Now that you have done all the work to get your servers configured, you are also going to want one or more books for testing.  Lets add a book to your setup.

.. note:: Keep Docker Running

   In everything that follows we assume that docker and all of the services are running.  If you have stopped docker then you will need to start it again.  ``docker compose up -d``  If you are not sure if docker is running then you can check with ``docker ps``


Prerequisites
~~~~~~~~~~~~~

To build a book using the `runestone` or `pretext` commands that are part of the rs monorepo you need to make sure you have the following installed:

1. ``npm``  (node package manager) On a Mac you can use homebrew to install this.  ``brew install npm`` on linux there are many articles such as `this one <https://linuxize.com/post/how-to-install-node-js-on-ubuntu-20-04/>`_ that walk you through it.
2. All of the javascript dependencies in the ``package.json`` file found in ``bases/rsptx/interactives``.  You can install these by running ``npm install`` from ``bases/rsptx/interactives``.
3. Package all of the runestone javascript dependencies into bundle.  You can do this by running ``npm run build`` from ``bases/rsptx/interactives``.  This will create many files in the ``runestone/dist`` folder.

Note: There is an alternative to the above steps that involves simply using ``pip install runestone`` in a **separate** virtual environment.  But then you will have to remember to switch back and forth between the different environments.  So I don't really recommend it.

Building the Book
~~~~~~~~~~~~~~~~~

1. Go to your ``$BOOK_PATH`` folder and clone a book.  Lets take our simple overview book as an example. run the command ``git clone https://github.com/RunestoneInteractive/overview.git``  You should see a new folder called ``overview``
2. The over view book is already in the database, so the only thing we need to do is build it.  ``cd overview`` and then run ``runestone build --all deploy``  If the command fails, make sure you have your virtual environment activated.  You can do this by running ``poetry shell`` from the top level directory (rs).

This builds the book and deploys it to ``overview/published/overview``  This is the location that the Runestone server will look for it.  Important:  The book name and the folder name must match.  So if you want to build a book called ``mybook`` then you need to clone it into a folder called ``mybook`` and then build it into ``mybook/published/mybook``.

The overview book is an easy example because the database already contains a course called overview by default.  Lets look at a more complicated scenario.  Lets say you want to build the active calculus book, and that you are going to want to use your server to support your department's calculus courses.

1. Clone the book into your ``$BOOK_PATH`` folder.  ``git clone https://github.com/active-calculus/active-calculus-single-mbx.git ac-single``
2. We need to add ac-single to the database of known courses with the ``rsmanage`` command.

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

3. Now we can build the book using the ``rsmanage`` command.  ``rsmanage build --ptx ac-single`` If you are running the database in docker then you should use ``docker compose run rsmanage rsmanage build --ptx ac-single`` This will build the book and deploy it to ``ac-single/published/ac-single``  The Active Calculus book should now be visible in the library.
4. Notice that we used ``ac-single`` for the course name as well as the base course name.  You **should not** use this course for your own courses.  Instead you should use the runestone web interface to create a custom course from the ``ac-single`` base course.  But first you will need to make the book available to the web interface.  You do this by setting a flag in the library table of the database.  For now you need to do this by hand.  This really should be another rsmanage subcommand but instead run ``psql $DEV_DBURL``

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

