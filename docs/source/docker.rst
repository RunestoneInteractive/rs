Docker and Environment Setup
=======================================

`Docker <https://docs.docker.com/>`__ is an application for building and running virtual machines.
Runestone uses it to automate the creation and operation of the various servers
that make up the Runestone software system.

Installing Docker 
-------------------

Follow these instructions to `install Docker <https://docs.docker.com/get-docker/>`__.

.. _docker-files:

Docker files
-------------------

Docker uses `Compose files <https://docs.docker.com/get-started/08_using_compose/>`__ to specify
how to create virtual machines.

Runestone currently makes use of three compose files that can be used in various combinations:

1. ``docker-compose.yml`` - Controls all of the servers except for the author server and database server.
2. ``db.compose.yml`` - Controls the database server.
3. ``author.compose.yml`` - Controls the author server.

There are three scenarios that we try to support out of the box:

1. Docker containers running runestone + bookserver + job + rsmanage + nginx + postgresql. This is the simplest setup for basic development or testing - none of the core projects will be running outside of docker. This is supported by using the ``docker-compose.yml`` and ``db.compose.yml`` files.

2. A setup that also includes a container running the author server. The author server is only required if you want to do development on it, or are running a production server where you want authors to be able to update their books without admin access to the rest of the system. This is supported by using the ``docker-compose.yml``, ``db.compose.yml``, ``author.compose.yml`` files.

3. A local installation of postgresql with the other services running in containers. This setup gives you more control over your database server architecture which may be desirable for production settings. It also allows you to rebuild all of the containers at will without wiping out your databases (possibly useful during development). This is pretty close to how we run in production on Runestone Academy.   This is supported by using the ``docker-compose.yml`` and ``author.compose.yml`` files, or just ``docker-compose.yml`` if you do not require the author server.
