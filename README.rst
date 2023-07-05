Runestone MonoRepo
==================

This repository collects together the various repositories related to
the Runestone Academy software. The idea of combining several
repositories into a single structure was motivated and inspired by the
Python polylith tools and projects.

As Runestone has grown over the years we have accreted a loads of new
functionality without ever stopping to reconsider an architecture that
would support easier implementation of new features while providing
stability for fundamental parts of the project that need to scale.
Docker was not invented at the time Runestone development started!

The goal of this re-working of the Runestone code will provide us with a
very docker friendly set of servers and services. we will use a polylith
software architecture to develop and maintain this set of services. The
following diagram shows what we are aiming at.

.. image:: https://runestone-monorepo.readthedocs.io/en/latest/_static/RunestoneArch.svg
   :alt: Runestone Architecture
   :align: center

Each of the servers in the diagram above will become a project in this
repo.

-  Each project is runnable from the top level
-  Each project builds its own docker image or command line program (rsmanage and runestone)
-  The entire suite of services is orchestrated by the
   ``docker-compose.yml`` file

Running your own server?
------------------------

If you run your own Runestone server we would love to hear from you.  Please make an issue in this repo and just tell us where you are at and how many students you serve.   As we seek grant funding, understanding the impact of Runestone is very important.  Thanks!

Understanding the Code Structure
--------------------------------

-  projects - define the artifacts - Docker images or applications could
   be a web application or a command line application or whatever.

-  bases - contains the public facing API for a project

-  components - contains code that supports one or more projects/bases

-  development - experimental and early work.

A Roadmap
---------

`Runestone Roadmap <https://github.com/orgs/RunestoneInteractive/projects/6/views/1>`_

Docs
----

See `Our Read the Docs page <https://runestone-monorepo.readthedocs.io/en/latest/developing.html>`_ for more complete documentation.

This setup uses poetry and two important plugins, the multi-project
plugin and the polylith plugin.

The official Polylith documentation: `high-level
documentation <https://polylith.gitbook.io/polylith>`__

A Python implementation of the Polylith tool:
`python-polylith <https://github.com/DavidVujic/python-polylith>`__

Documentation for building and running each of the projects is in the respective project directory.

Please make sure you keep your fork up to date with main.  We are actively working on this new organization of the Runestone code, and there are likely to be lots of changes, especially throughout the summer months.

Contributing
------------

There is so much to do on this project, and we are happy to accept contributions.  Please see the `Contributing Guide <https://runestone-monorepo.readthedocs.io/en/latest/contributing.html>`_ for more information.   We are especially interested in contributions that help us to improve the documentation, and the test coverage of the code.

If you want to know where we are going, and what things are in active development or in need of immediate help please take a look at our projects page on
github: `Runestone Projects <https://github.com/orgs/RunestoneInteractive/projects>`_

We are working on building out a longterm roadmap for Runestone.  You can see that here: `Runestone Roadmap <https://github.com/orgs/RunestoneInteractive/projects/6/views/1>`_



Our Community
-------------

The Runestone community has been actively developing and supporting this project since 2011.  However in the 2023 I decided to move to a mono repo.  Unfortunately this means that the history of the individual repositories is lost.  I am sorry for this, but I think the benefits of a mono repo will be worth it.  The original repositories are still available, but they are no longer being actively developed, if you need to point to your contributions to Runestone, please use the old repos as a reference.

Our authoring language is PreTeXt.  We have a very active community of PreTeXt authors and developers.  If you are interested in contributing to the PreTeXt project, please visit the `PreTeXt project page <https://pretextbook.org>`_.

.. raw:: html

    <blockquote class="badgr-badge" style="font-family: Helvetica, Roboto, &quot;Segoe UI&quot;, Calibri, sans-serif;"><a href="https://api.badgr.io/public/assertions/bhQ1jKReQj27qAt-jqqoPQ?identity__email=brad%40runestone.academy"><img width="120px" height="120px" src="https://media.badgr.com/uploads/badges/assertion-bhQ1jKReQj27qAt-jqqoPQ.png"></a><p class="badgr-badge-name" style="hyphens: auto; overflow-wrap: break-word; word-wrap: break-word; margin: 0; font-size: 16px; font-weight: 600; font-style: normal; font-stretch: normal; line-height: 1.25; letter-spacing: normal; text-align: left; color: #05012c;">POSE Training Program - Spring 2023 Pilot</p><p class="badgr-badge-date" style="margin: 0; font-size: 12px; font-style: normal; font-stretch: normal; line-height: 1.67; letter-spacing: normal; text-align: left; color: #555555;"><strong style="font-size: 12px; font-weight: bold; font-style: normal; font-stretch: normal; line-height: 1.67; letter-spacing: normal; text-align: left; color: #000;">Awarded: </strong>May 18, 2023</p><p style="margin: 16px 0; padding: 0;"><a class="badgr-badge-verify" target="_blank" href="https://badgecheck.io?url=https%3A%2F%2Fapi.badgr.io%2Fpublic%2Fassertions%2FbhQ1jKReQj27qAt-jqqoPQ%3Fidentity__email%3Dbrad%2540runestone.academy&amp;identity__email=brad%40runestone.academy" style="box-sizing: content-box; display: flex; align-items: center; justify-content: center; margin: 0; font-size:14px; font-weight: bold; width: 48px; height: 16px; border-radius: 4px; border: solid 1px black; text-decoration: none; padding: 6px 16px; margin: 16px 0; color: black;">VERIFY</a></p><script async="async" src="https://badgr.com/assets/widgets.bundle.js"></script></blockquote>
    
