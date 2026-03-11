Running a Runestone Server
==========================

Maybe you just want to run your own server for a small course. Maybe you are an author who just wants to preview what your book will look like in Runestone.  (Hint:  Its going to look very much like the plain html, unless you have Java, C or C++ code) Or maybe you are interested in getting involved in the development of the Runestone tools, but want to experiment first.  This document will help you get started without having to install a lot of software on your own machine, or having to worry about setting up a web server or database or any development environment.  This will work for both linux and macOS on Apple Silicon or Intel based machines.  It will also work on Windows, but you will need to install WSL2 and Docker Desktop for Windows.

Quick Start
-----------

Get Runestone running with a single command:

.. code-block:: bash

   bash <(curl -fsSL https://raw.githubusercontent.com/RunestoneInteractive/rs/main/init_runestone.sh)

The script will guide you through an interactive setup process, asking questions along the way to configure your Runestone server.

**Before running the command:**

#. Navigate to where you want the configuration files created (e.g., ``mkdir ~/runestone && cd ~/runestone``)
#. Make sure you have the prerequisites installed (see below)
#. For Windows users: Run this from a WSL2 terminal, not PowerShell or Command Prompt

**After setup completes:**

- Access your server at http://localhost
- Log in with username: ``testuser1``, password: ``xxx``
- Check ``init_runestone.log`` if you encounter any issues

Prerequisites
-------------

Before running the setup script, you need:

**Required:**

- **Docker Desktop** with Docker Compose 2.20.2 or later (current version: 2.38.2)
  
  - Download from https://docs.docker.com/compose/install/
  - Make sure Docker Desktop is running before starting the setup
  - For Windows: Enable WSL2 integration in Docker Desktop settings
  - **Important**: Configure file sharing in Docker Desktop (Settings → Resources → File Sharing) to include the directory where you'll create your Runestone configuration and your ``BOOK_PATH`` directory. Without this, Docker won't be able to access your book files.

- **WSL2** (Windows users only)
  
  - The script must run from a WSL2 terminal (Ubuntu, Debian, etc.)
  - Do not use PowerShell or Command Prompt

**Optional:**

- **Git** - Only needed if you want to clone book repositories

  - Most users will want to add books, so this is recommended
  - You can install it later if you skip book setup initially

How the Setup Script Works
---------------------------

The automated setup script performs several steps to get Runestone running. Understanding these steps can help you troubleshoot issues and better understand how Runestone works.

**Step 1: Platform Detection and Prerequisite Validation**

The script first detects your operating system (Linux, macOS, or Windows WSL2) and validates:

- Docker is installed and running
- Docker Compose version is 2.20.2 or later  
- Git is installed (optional, but will warn if missing)
- On Linux (non-WSL), checks if you're in the docker group

**Step 2: Configuration File Setup**

The script determines if you're running in "standalone mode" or "traditional mode":

- **Standalone mode**: If ``docker-compose.yml`` and ``sample.env`` don't exist in the current directory, the script downloads them from the GitHub repository
- **Traditional mode**: If you've cloned the repository, it uses the existing files

This allows the script to work whether you've cloned the repo or are starting from scratch.

**Step 3: Environment Configuration (BOOK_PATH)**

The script creates a ``.env`` file and prompts you to configure ``BOOK_PATH`` — the directory where your Runestone books will be stored.

**What is BOOK_PATH?**

- A directory on your host machine (not inside Docker) where book source code lives
- This directory is mounted into Docker containers so they can access and build your books
- Example paths: ``~/runestone/books``, ``/home/username/books``, ``C:\Projects\books`` (Windows)

**Windows path handling:**

If you're on WSL2, you can provide paths in Windows format (``C:\Projects\books``) and the script automatically converts them to WSL format (``/mnt/c/Projects/books``).

**What happens to BOOK_PATH:**

- If the directory doesn't exist, the script offers to create it
- The path is saved to ``.env`` so Docker knows where to find your books
- You'll use this directory later when cloning book repositories

**Docker Desktop users:** Make sure this directory is shared with Docker. Go to Docker Desktop → Settings → Resources → File Sharing and add your ``BOOK_PATH`` directory to the list. This allows the Docker containers to access and build your books.

**Step 4: Docker Image Pulling**

The script runs ``docker compose pull`` to download pre-built Docker images from GitHub Container Registry (ghcr.io).

**What are these images?**

Runestone uses a microservices architecture with multiple servers:

- ``db`` - PostgreSQL database server
- ``book_server`` - Serves interactive textbook content
- ``assignment_server`` - Handles assignments and grading
- ``rsmanage`` - Management tools for books and courses
- Several other services for authentication, logging, etc.

These images are pre-built, so you don't need the Runestone source code to run the server.

**Step 5: Database Initialization**

The script starts the PostgreSQL database container (``docker compose up -d db``) and initializes it with the Runestone schema (``rsmanage initdb``).

**What gets created:**

- Database tables for users, courses, books, assignments, responses, etc.
- Test user accounts including ``testuser1`` (password: ``xxx``)
- Base courses for popular Runestone books (``overview``, ``thinkcspy``, ``pythonds``, etc.) that can be used when registering books

This is the foundation that stores all your course data.

**Step 6: Start All Services**

The script starts all Runestone services (``docker compose up -d``), including:

- Web servers (book server, assignment server, etc.)
- Background workers for processing tasks
- An nginx reverse proxy to route requests

The services communicate with each other and the database to provide the full Runestone experience.

**Step 7: Book Setup (Optional)**

If you choose to add a book, the script:

#. **Clones the repository**: Downloads the book source code to your ``BOOK_PATH`` directory (e.g., ``git clone https://github.com/RunestoneInteractive/overview.git``)

#. **Registers the book**: Adds the book to the database using ``rsmanage addbookauthor``, creating a "base course" record associated with your user account

#. **Builds the book**: Runs ``rsmanage build`` to convert the book source (RST or PreTeXt) into interactive HTML with embedded questions, visualizations, and other Runestone features

**Base course vs. teaching course:**

- A "base course" is the master version of the book content
- When teaching a class, you create a separate course that references the base course
- This allows multiple instructors to teach from the same book with different settings

**Step 8: Course Creation (Optional)**

If you choose to create a course, the script runs ``rsmanage addcourse`` which:

- Creates a new course record in the database
- Links it to a base course (book)
- Sets up the course configuration (term dates, public/private status, etc.)
- Allows you to enroll students and manage assignments

Students will register for your course and use the book content within that course context.

**Setup Complete!**

After these steps, your Runestone server is fully operational and accessible at http://localhost.

Developer Setup (From Cloned Repository)
-----------------------------------------

If you're contributing to Runestone development or want the source code locally, clone the repository first:

.. code-block:: bash

   git clone https://github.com/RunestoneInteractive/rs.git
   cd rs
   ./init_runestone.sh

The script will detect that ``docker-compose.yml`` and ``sample.env`` already exist and run in "traditional mode" without downloading files. All the same setup steps occur — you just have the source code available for development.

**Why clone the repository?**

- You want to modify Runestone server code
- You're contributing features or bug fixes
- You need to build Docker images locally instead of using pre-built ones
- You want to run tests or use additional development tools

For most users just running a Runestone server, cloning the repository is not necessary.

**For full development environment setup** (building from source, running tests, etc.), see the :doc:`developing` documentation.

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
