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

Runestone currently makes use of the ``docker-compose.yml`` - Controls all of the servers except for the author server and database server. and four different profiles:

* ``basic`` - this will start up the default servers plus a database server in the composed app.
* ``dev`` - this will start up the default servers plus development nginx server in the composed app.
*  ``production`` - this will start up the default servers plus the ``pgbouncer`` server in the composed app.
*  ``author`` - this will start up the default servers plus the ``author`` server in the composed app.

You can specify which profile to use by setting the ``COMPOSE_PROFILES`` environment variable or the ``--profile`` command line switch.  The sample.env file has an example of how to set the environment variable to use the basic profile.  To add additional profiles you can add them to the environment variable separated by commas.


There are three scenarios that we try to support out of the box:

1. Docker containers running runestone + bookserver + jobe + rsmanage + nginx + postgresql. This is the simplest setup for basic development or testing - none of the core projects will be running outside of docker. This is supported by using the ``docker-compose.yml`` and ``basic`` profile.

2. A setup that also includes a container running the author server. The author server is only required if you want to do development on it, or are running a production server where you want authors to be able to update their books without admin access to the rest of the system. This is supported by using the ``docker-compose.yml`` file and the ``basic`` and ``author`` profiles.

3. A local installation of postgresql with the other services running in containers. This setup gives you more control over your database server architecture which may be desirable for production settings. It also allows you to rebuild all of the containers at will without wiping out your databases (possibly useful during development). This is pretty close to how we run in production on Runestone Academy.   This is supported by using the ``docker-compose.yml`` and ``author`` profile, or just ``docker-compose.yml`` if you do not require the author server.

