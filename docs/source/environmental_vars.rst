.. _environment-variables:

Environment Variables Setup
=======================================

Environment variables are very important in a system like Runestone - they are a way to provide values for secrets that need to be kept private (and thus can't live in the code itself which is publicly accessible).  They are also used to provide startup time flexibility to define how various components will work.  Some environment variables are important on the host side (h), some are important on the docker side (d), and some are important on both sides (b).

Make a .env File
---------------------

You need to make a ``.env`` folder in the root level of your repository to define environmental variables.
There is already a ``sample.env`` file in the repository root, you should copy that sample into a file named ``.env``.

The ``.env`` file is read by docker-compose and used to set environment variables in the docker containers. If you installed ``poetry-dotenv-plugin``, poetry will also automatically read it on the host side.

.. note::
   If you chose not to install ``poetry-dotenv-plugin``, you will need to manually define the host (h) environment variables listed below in your login profile (.bashrc, config.fish, .zshrc, etc).

The ``.gitignore`` file is set to ignore ``.env``, so your local configuration will not be checked into git.


Setup .env Values
---------------------

The ``.env`` file defines the variables listed below. The default values for most of them should be fine - the ones you are most
likely going to want to change are ``BOOK_PATH``, ``DEV_DBURL``, and ``DC_DEV_DBURL``.

Core variables:

* ``BOOK_PATH`` - *(h)* This is the path to the folder (on the HOST) that contains all of the books you want to serve. So if you are running docker on a mac and your books are in ``/Users/bob/Runestone/books`` then you would set this to ``/Users/bob/Runestone/books``. It is recommended you make a folder for this purpose that is outside of the Runestone repository itself. Set this variable to point at that folder.
* ``COMPOSE_PROFILES`` *(h)* - This is a list of profiles that you want to use when running docker-compose.  The default is ``basic`` which starts the database in docker.  If you want to run the production profile you would set this to ``production`` which will start pgbouncer. If you want to run the servers in dev mode (not in docker) you would set this to ``dev``.  If you want to run the author server you would set this to ``author`` You can also combine profiles by separating them with a comma.  For example ``basic,dev`` would start the database in docker and the servers on the host.
* ``DEV_DBURL`` *(b)* - This is the URL that is used to connect to the database in development. You need to set it based on whether you are going to run the database through docker (default, simpler) or manually on your local machine (more flexible). See :ref:`Database Options<database-options>` for more information on the choices.

   * If you are running a postgresql container with the other servers through docker, you should set this to: ``postgresql://runestone:runestone@localhost:2345/runestone_dev``
   * If you are using postgres on your local machine, set this to: ``postgresql://runestone:runestone@localhost/runestone_dev``

* ``DC_DEV_DBURL`` *(d)* - This is the URL that is used to connect to the database in docker-compose development.

   * If you are running a postgresql container with the other servers through docker,  you should set this to: ``postgresql://runestone:runestone@db/runestone_dev``
   * If you are using postgres on your local machine, set this to: ``postgresql://runestone:runestone@host.docker.internal/runestone_dev``


There are a number of other variables - none of them are important unless you are running in production.

* ``DBURL`` *(b)* - This is the URL that is used to connect to the database in production.
* ``DC_DBURL`` *(d)* - This is the URL that is used to connect to the production database in docker-compose.  If this is not set it will default to ``$DBURL``.  This is useful if you want to use a different database for docker-compose than you do for development.
* ``SSH_AUTH_SOCK`` *(h)* - This is the path to the ssh agent socket.  This is used to allow the docker container to use your ssh keys to use rsync to deploy books to the workers.  You must set this on the host side, typically by running ``eval $(ssh-agent)`` from  bash.  You will also want to run ``ssh-add`` to add a key to the agent.  Both of these can be done in your .bashrc file.  If you are using a different shell you will need to figure out how to do the equivalent.  This is only important if you are running in production mode behind a load balancer.
* ``JWT_SECRET`` *(d)* - this is the secret used to sign the JWT tokens.  It should be a long random string.  You can generate one by running ``openssl rand -base64 32``  You should set this to the same value in all of the services.
* ``WEB2PY_PRIVATE_KEY`` *(d)* - this is the secret that web2py uses when hashing passwords. It should be a long random string.  You can generate one by running ``openssl rand -base64 32``  You should set this to the same value in all of the services.
* ``SERVER_CONFIG`` *(d)* - this should be production, development, or test.  It is used to determine which database URL to use.
* ``WEB2PY_CONFIG`` *(d)* - should be the same value as ``SERVER_CONFIG``.  It is used to determine which database URL to use.  This will go away when we have eliminated the web2py framework from the code base.
* ``RUNESTONE_HOST`` *(d)* - this is the canonical host name of the server.  It is used to generate links to the server.  For development you should just set it to ``localhost``. In production it should be something like ``runestone.academy`` or ``runestone.academy:8000`` if you are running on a non-standard port.
* ``LOAD_BALANCER_HOST`` *(d)* - this is the canonical host name of the server when you are running in production with several workers.  It is used to generate links to the server. For development purposes you should not set this variable. In production it should be something like ``runestone.academy`` or ``runestone.academy:8000`` if you are running on a non-standard port.  You would typically only need to set this or RUNESTONE_HOST.
* ``NUM_SERVERS`` *(d)* - this is the number of workers you are running. It will default to 1 if not set.  This is only important if you are running in production mode, behind a load balancer.
* ``ALLOW_INSECURE_LOGIN`` *(d)* - this is a flag that allows users to log in without HTTPS.  This should only be used for development purposes and not in production.  This can be set to ``yes`` or ``true`` in the ``docker-compose.yml`` file for the ``runestone`` service.  If you are running in production mode, you should **not** set this variable.  Note, LTI will not work if this is set.
* ``LTI1P3_PRIVATE_KEY`` *(d)* - this is the private key used for LTI 1.3 authentication.  It should be a long random string.  You can generate one by running ``openssl genpkey -algorithm RSA -out private.key -pkeyopt rsa_keygen_bits:2048``.  
* ``LTI1P3_PUBLIC_KEY`` *(d)* - this is the public key used for LTI 1.3 authentication.  You can generate one by running ``openssl rsa -in private.key -pubout -out public.key``.  This is used to verify the signature of the LTI 1.3 authentication request.
* ``FERNET_SECRET`` *(d)* - this is the secret used for encrypting and decrypting data.  It is required for encrypted columns. You can generate one by running ``openssl rand -base64 32``.  

.. note:: Host Side Development Notes

   When you are starting one or more servers directly on the host (not in docker) then you will also want to define most of the docker only variables on the host side in order for your servers to be configured properly.  This is another good reason to use the dot-env plugin for poetry.

Here is a summary of the profiles and services available and which should be set to start the various services.  Again, remember that you can combine profiles by separating them with a comma.  For example ``basic,dev`` would start the database in docker and the servers on the host.

.. list-table::
   :header-rows: 1

   * - Profile
     - db
     - pgbouncer
     - jobe
     - book
     - runestone
     - nginx
     - assignment
     - worker
     - author
     - nginx_dstart_dev
   * - default
     - no
     - no
     - yes
     - yes
     - yes
     - yes
     - yes
     - no
     - no
     - no
   * - basic
     - yes
     - no
     - yes
     - yes
     - yes
     - yes
     - yes
     - no
     - no
     - no

   * - production
     - no
     - yes
     - yes
     - yes
     - yes
     - yes
     - yes
     - no
     - no
     - no
   * - dev
     - no
     - no
     - yes
     - yes
     - yes
     - yes
     - yes
     - no
     - no
     - yes
   * - author
     - no
     - no
     - yes
     - yes
     - yes
     - yes
     - yes
     - yes
     - yes
     - no
