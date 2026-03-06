Running a Runestone Server
==========================

Maybe you just want to run your own server for a small course. Maybe you are an author who just wants to preview what your book will look like in Runestone.  (Hint:  Its going to look very much like the plain html, unless you have Java, C or C++ code) Or maybe you are interested in getting involved in the development of the Runestone tools, but want to experiment first.  This document will help you get started without having to install a lot of software on your own machine, or having to worry about setting up a web server or database or any development environment.  This will work for both linux and macOS on Apple Silicon or Intel based machines.  It will also work on Windows, but you will need to install WSL2 and Docker Desktop for Windows.

Automated Setup (Recommended for First-Time Users)
---------------------------------------------------

For new users, we provide an automated setup script that handles all of the essential configuration steps for you. The script will guide you through the entire process with interactive prompts.

**Prerequisites:**

- Docker Desktop with Docker Compose 2.20.2 or later (current version: 2.38.2)
- Git
- For Windows: WSL2 with Docker Desktop WSL integration enabled

**Quick Start:**

#. Clone the Runestone repository: ``git clone https://github.com/RunestoneInteractive/rs.git``

#. Change to the rs directory: ``cd rs``

#. Run the setup script: ``./init_runestone.sh``

   **Note for Windows users:** You must run this script from a WSL2 terminal, not from PowerShell or Command Prompt.

The script will:

- Validate that Docker and Git are installed and running
- Create and configure your ``.env`` file with the ``BOOK_PATH``
- Pull all required Docker images
- Start and initialize the database
- Optionally clone, build, and configure your first book
- Optionally create a course for students

After the script completes, you can access your Runestone server at http://localhost with the default test credentials (username: ``testuser1``, password: ``xxx``).

**Note:** The script creates a log file (``init_runestone.log``) that you can review if you encounter any issues.

Manual Setup
------------

If you prefer more control over the setup process, or if you're troubleshooting issues, you can set up the Runestone server manually by following these steps:

The Runestone server uses docker compose to start up a number of containers that work together to provide the Runestone environment.  Here are the steps to get started:

#. Install Docker and Docker Compose on your machine.  You can find instructions for your operating system here: https://docs.docker.com/compose/install/  If you already have docker installed you can skip this step. but make sure that ``docker compose version`` tells you that you are running 2.20.2 or later. The current version is 2.38.2.
    - If you are using Docker Desktop, you will probably need to add paths to to the list of virtual file shares.  Go to Settings -> Resources -> File Sharing and add the path to the rs directory you will create below, as well as the ``BOOK_PATH`` directory you will create below.

#. Clone the Runestone repository to your local machine.  You can do this by running the following command: ``git clone https://github.com/RunestoneInteractive/rs.git``

#. Change to the rs directory: ``cd rs``

#. copy the sample.env file to .env: ``cp sample.env .env``  At a minimum you will then need to edit ``.env`` to provide a value for ``BOOK_PATH``

#. Run the command ``docker compose pull`` this will pull the prebuilt images for the runestone services from our public docker hub repository.  This will take a while the first time you run it, but subsequent runs will be faster.

#. Start the database server by running the following command: ``docker compose up -d db``

#. Initialize the database by running the following command: ``docker compose run --rm rsmanage rsmanage initdb``

#. Start the Runestone server by running the following command: ``docker compose up -d``

#. You should now be able to access the Runestone server by going to http://localhost in your web browser.  You can log in with the username ``testuser1`` and the password ``xxx``.

#. Now add a book. ``cd /your/path/to/book`` (the same value you used for ``BOOK_PATH``) and clone a book.  For example: ``git clone https://github.com/RunestoneInteractive/overview.git``

#. Add the book to the database.  First return to the rs directory.  Run ``docker compose run --rm rsmanage rsmanage addbookauthor`` You will then be prompted to enter some information about the book and the author.:

    .. code-block:: text

        Using configuration: development
        Using database: runestone_dev
        Checking database connection
        postgresql+asyncpg://bmiller:@localhost/runestone_dev
        Database connection successful
        document-id or basecourse : foobar
        Runestone username of an author or admin: : testuser1

    If the course already exists in the database you will get an error message and the command will exit. 

    Note: This command sets up a "base course" This is not a course you would normally teach out of.  You would normally create a course to teach from throught the web interface or using the ``addcourse`` sub command.  

#. Run the following command: ``docker compose run --rm rsmanage rsmanage build overview``  (replace ``overview`` with the name of the course you added in the previous step).  If you are building a PreTeXt book you will need to run ``docker compose run --rm rsmanage rsmanage build --ptx overview``

#. You should now be able to access the overview book on your server running on localhost.  The url to go directly to your book is is `http://localhost/ns/books/published/yourbook/index.html``

#. If you want to create a course for students to use, you can run the following command: ``docker compose run --rm rsmanage rsmanage addcourse``  This will create a course with the name you provide.

#. Additional commands are available (for example to add an instructor to a course).  Run ``docker compose run --rm rsmanage rsmanage --help`` to see a list of available commands.

Managing Your Server
--------------------

**Stopping and Starting:**

- Stop the server: ``docker compose stop``
- Start the server: ``docker compose start``
- Restart services: ``docker compose restart``
- Shut down and remove containers: ``docker compose down``
- Shut down and remove volumes (WARNING: deletes all data): ``docker compose down -v``

**Viewing Logs:**

To view logs from all services: ``docker compose logs -f``

**Common Management Tasks:**

- Add another book: ``docker compose run --rm rsmanage rsmanage addbookauthor``
- Build a book: ``docker compose run --rm rsmanage rsmanage build <bookname>``
- Build a PreTeXt book: ``docker compose run --rm rsmanage rsmanage build --ptx <bookname>``
- Create a course: ``docker compose run --rm rsmanage rsmanage addcourse``
- Add an instructor to a course: ``docker compose run --rm rsmanage rsmanage addinstructor``

**Troubleshooting:**

If you used the automated setup script (``init_runestone.sh``), check the ``init_runestone.log`` file in the rs directory for detailed information about the setup process. This log can help diagnose any issues that occurred during initialization.

For database issues, you can reset the database by running ``docker compose down -v`` to remove all volumes, then re-run the initialization steps (either manually or via ``./init_runestone.sh``).
