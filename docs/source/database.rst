.. _database-options:

Database setup
=======================================

The database is a critical component as it is the glue that ties together the various servers.  You have a few different options for database setup.

1. Install Postgresql as part of the docker-compose setup (default). This requires the least manual work and keeps the database tightly tied to the rest of the docker images. Because the database will be running as a docker container, if you ever destroy the container all of the data in the database will be lost. If you choose this option, you do not have to do anything special at this point.

2. Install Postgresql on your local host (either natively or in a container). This allows you to use an existing database and to keep your database more insulated from the rest of the project (so that say test data persists through a rebuild of all the servers).

Install Postgresql with docker-compose
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This is the default option and requires the least manual work.  Just make sure that you have your ``CONTAINER_PROFILES`` varaible set to include ``basic`` This is how it is set up in the ``sample.env`` file.  The database will be running as a docker container, and if you ever destroy the container all of the data in the database will be lost.  The default environment variables are set up so that you can access the database from outside the container on port 2345.  If you want to do this you will need to install ``psql`` on your host machine.

You need to initialize the database with ``rsmanage initdb`` or ``docker compose run rsmanage rsmanage initdb`` to do it all inside the containerized application.  This will create the database tables and add the initial data.

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


Database migrations
~~~~~~~~~~~~~~~~~~~

We use ``alembic`` to help track changes to the database schema. Note make sure that your run ``poetry shell`` and that you run the ``alembic`` command from the main ``rs`` folder.  The first time you clone the project you should run ``alembic stamp head`` to let alembic know that the current state of the database is the head.  This will allow you to run migrations in the future to ensure that your database schema is in sync with the ``models.py`` file.  In the future when you pull changes You can run ``alembic upgrade head`` to apply all of the migrations to the current database.   You can also run ``alembic history`` to see all of the migrations that have been applied to the database.  The ``build checkdb`` command will also do its best to check that the database is up to date and will run the migrations for you if it can.

If you make a change to the database model as part of your development work, please create a migration by running ``alembic revision --autogenerate -m "some message"``.  This will create a new migration file in the ``alembic/versions`` directory.  You can then edit this file to make sure that the migration does what you want. You can then run ``alembic upgrade head`` and this will apply the changes to your database.  You should commit this and submit it as part of your PR.  If you are not sure how to do this, please ask for help in the ``developer-forum`` channel on the Runestone discord server, **after** you have consulted the extensive documentation and tutorials that are available to help you learn how to use alembic.

If you drop the database and start over by running ``rsmanage initdb`` you will need to run ``alembic stamp head`` again to mark the current state of the database.

If you have been running your own server for a while and you are not sure if you have all of the migrations applied you can run ``alembic upgrade head`` to apply all of the migrations to the current database.  You can also run ``alembic history`` to see all of the migrations that have been applied to the database.  If the migrations fail for reasons like a column already exists then you can run ``alembic upgrade head --sql`` to see the sql that would be run.  You can then edit the migration file to remove the offending line and then run the migration again.  Once you have manually got yourself back in sync you can run ``alembic stamp head`` to mark the current state of the database.  You could also use ``alembic stamp <version>``  followed by ``alembic stamp head`` to work your way from the base to the head one revision at a time.  This might be easier than copy and pasting into psql.  Once you are back in sync things should work as expected.
