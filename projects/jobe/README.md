# JobeInABox

![Docker Stars](https://img.shields.io/docker/stars/trampgeek/jobeinabox.svg)
![Docker Pulls](https://img.shields.io/docker/pulls/trampgeek/jobeinabox.svg)
![Docker Automated](https://img.shields.io/docker/cloud/automated/trampgeek/jobeinabox.svg)
![Docker Build](https://img.shields.io/docker/cloud/build/trampgeek/jobeinabox.svg)

## Runestone Notes

We adopt the Dockerfile with just a few modifications

0. The stock image is for amd64 and some of us need Apple silicon
1. install extra python modules
2. tweak parameters for timeouts and memory use to better accommodate unit tests
3. Allow for us to add additional languages.
4. Tweak the timezone to UTC
5. Allow for us to add unit test frameworks

We use the https://github.com/RunestoneInteractive/jobe.git repo to populate /var/www/html/jobe
in the container as we have made some specific changes to runguard.c that we need to incorporate.

## Building and running your own image locally (strongly recommended)

There are several ways to build and run a JobeInABox container, for example:

-   [Podman](https://developers.redhat.com/blog/2019/02/21/podman-and-buildah-for-docker-users/)
-   [Docker](https://docs.docker.com/)

For production use you should build your own image using the local timezone. In this example we use Docker as follows:

Pull [this repo from Github](https://github.com/trampgeek/jobeinabox), cd into the jobeinabox directory and type a command
of the form

    sudo docker build . -t my/jobeinabox --build-arg TZ="Europe/Amsterdam"

You can then run your newly-built image with the command

    sudo docker run -d -p 4000:80 --name jobe my/jobeinabox

This will give you a jobe server running on port 4000, which can then be
tested locally and used by Moodle as explained in the section "Using jobeinabox" below.

## Using the pre-built jobeinabox image on docker hub

To run the pre-built Docker Hub image, just enter the command:

    sudo docker run -d -p 4000:80 --name jobe trampgeek/jobeinabox:latest

This will give you a jobe server running on port 4000, which can then be
tested locally and used by Moodle as explained in the section "Using jobeinabox" below.

### Warnings:

1.  The image is over 1 GB, so may take a long time to start the first
    time, depending on your download bandwidth.

## Using jobeinabox

Having started a jobeinabox container by either of the above methods, you
can check it's running OK by browsing to

     http://[host_running_docker]:4000/jobe/index.php/restapi/languages

and you should get a JSON-encoded list of the supported languages, namely

    [["c","7.3.0"],["cpp","7.3.0"],["java","10.0.2"],["nodejs","8.10.0"],["octave","4.2.2"],["pascal","3.0.4"],["php","7.2.7"],["python3","3.6.5"]]

If you wish to run the test suite within the container, use the command

    sudo docker exec -t jobe /usr/bin/python3 /var/www/html/jobe/testsubmit.py

To set your Moodle/CodeRunner plugin to use this dockerised Jobe server, set the Jobe server field in the CodeRunner admin settings (Site Administration > Plugins > Question types > CodeRunner) to

    [host_running_docker]:4000

Do not put http:// at the start.

To stop the running server, enter the command:

    sudo docker stop jobe

To remove the running server, enter the command:

    sudo docker rm jobe

To check if there is anything left, enter the command

    sudo docker ps -a

## Notes on security:

1.  Note that while the container in which this Jobe runs should be secure, the
    container's network is currently just bridged across to the host's network.
    This means that Jobe can be accessed from anywhere that can access the host
    and can access any URI that the host can access. Firewalling of the host is
    essential for production use.

1.  Rebuild the container regularly to ensures that it is running
    with the latest jobe version and security updates.
