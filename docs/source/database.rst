.. _database-options:

Database setup
=======================================

The database is a critical component as it is the glue that ties together the various servers.  You have a few different options for database setup.

1. Install Postgresql as part of the docker-compose setup (default). This requires the least manual work and keeps the database tightly tied to the rest of the docker images. Because the database will be running as a docker container, if you ever destroy the container all of the data in the database will be lost. If you choose this option, you do not have to do anything special at this point.

2. Install Postgresql on your local host (either natively or in a container). This allows you to use an existing database and to keep your database more insulated from the rest of the project (so that say test data persists through a rebuild of all the servers).


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
