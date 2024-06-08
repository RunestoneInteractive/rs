Running a Runestone Server
==========================

Maybe you just want to run your own server for a small course.  Or maybe you are interested in getting involved in the development of the Runestone tools, but want to experiement first.  This document will help you get started without having to install a lot of software on your own machine, or having to worry about setting up a web server or database or any development environment.  This assumes that you are using some kind of linux machine.  If you are using a modern apple silicon based mac, then you will need to build the images locally until I figure out how to publish both arm and x86 images to docker hub.

The Runestone server uses docker compose to start up a number of containers that work together to provide the Runestone environment.  Here are the steps to get started:

1. Install Docker and Docker Compose on your machine.  You can find instructions for your operating system here: https://docs.docker.com/compose/install/  If you already have docker installed you can skip this step. but make sure that ``docker compose version`` tells you that you are running 2.20.2 or later. The current version is 2.27.1

2. Clone the Runestone repository to your local machine.  You can do this by running the following command: ``git clone https://github.com/RunestoneInteractive/rs.git``

3. Change to the rs directory: ``cd rs``

4. copy the sample.env file to .env: ``cp sample.env .env``

5. Run the command ``docker compose pull`` this will pull the prebuilt images for the runestone services from our public docker hub repository.  This will take a while the first time you run it, but subsequent runs will be faster.

6. Start the database server by running the following command: ``docker compose up -d db``

7. Initialize the database by running the following command: ``docker compose run rsmanage rsmanage initdb``

8. Start the Runestone server by running the following command: ``docker compose up -d``

9. You should now be able to access the Runestone server by going to http://localhost in your web browser.  You can log in with the username ``testuser1`` and the password ``xxx``.

10. Now add a book. ``cd ~/Runestone/books`` and clone a book.  For example: ``git clone https://github.com/RunestoneInteractive/overview.git``

11. Now go back to the rs directory and run the following command: ``docker compose run rsmanage rsmanage build overview`` 

12. You should now be able to access the overview book on your server running on localhost.

If you want to stop the server, you can run the following command: ``docker compose stop``

Almost all of this could be scripted, and it would be an awesome idea for a PR if someone wanted to create a little script that would do all of this for you.  If you are interested in doing that, please let us know and we can help you get started.