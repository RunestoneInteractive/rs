Working on Runestone: Overview
==============================

We welcome anyone who is willing to help us with this project.  But it is important to recognize that working on any system that is in production, on the web, for tens of thousands of users is a bit different than working on a project that is just for your own use.  In order to work on Runestone effectively you will need to know (or be willing to learn) a lot of different skills, including:

* Docker
* Git and GitHub
* HTML
* CSS
* Javascript
* Python
* SQL and relational databases
* The Unix command line

We try to hide the really hard stuff in scripts, but sometimes you just have to know stuff.  We are happy to help you learn, but you will need to be willing to learn, and you will need to be patient and recognize that in an open source project there are sometimes things that are not documented well, or that documentation is out of date.  We are working on that, but it is a big job.  A friend of mine would always say "Use the source Luke."  Generally speaking the latest released version of the repository is "in production" which means that it is working for hundreds of thousands of people.  There could be a window where the HEAD is broken for a particular feature, but certainly not for the whole system.

Getting started with Runestone Development
------------------------------------------

To get started, work through the following sections of the documents. Each step will be explained in further detail in their own respective page. Briefly, you will need to:

* :ref:`Get the Runestone code<get-the-code>`
* :ref:`Set up Poetry and other tools<development-prerequisites>`
* :ref:`Set up environmental variables<environment-variables>`
* :ref:`Chose how to set up your database<database-options>`
* :ref:`Build the various Runestone servers and run them<building-servers>`
* :ref:`Clone and build one or more books<adding-book>`

This diagram gives you an overview of the whole process.  It is not a trivial exercise to get this all going, but with some patience and careful attention to detail you can do it.

.. image:: ../images/MonoRepoBuild.svg

To get started, follow the instructions :ref:`to acquire the code for Runestone<get-the-code>`.

Deploying a production version
------------------------------

If you are interested in deploying a production version of Runestone to serve books, begin by setting up a development environment. Once you are confident in that process, the :ref:`moving to production instructions<moving-to-production>` will help you set up a production ready server.
