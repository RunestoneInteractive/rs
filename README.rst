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

.. image:: docs/images/RunestoneArch.svg
   :alt: Runestone Architecture
   :align: center

Each of the servers in the diagram above will become a project in this
repo.

-  Each project is runnable from the top level
-  Each project builds its own docker image
-  The entire suite of services is orchestrated by the
   ``docker-compose.yml`` file

Understanding the Code Structure
--------------------------------

-  projects - define the artifacts - Docker images or applications could
   be a web application or a command line application or whatever.

-  bases - contains the public facing API for a project

-  components - contains code that supports one or more projects/bases

-  development - experimental and early work.

A Roadmap
---------

Docs
----

See `Our Read the Docs page <https://runestone-monorepo.readthedocs.io/en/latest/developing.html>`_ for more complete documentation.

This setup uses poetry and two important plugins, the multi-project
plugin and the polylith plugin.

The official Polylith documentation: `high-level
documentation <https://polylith.gitbook.io/polylith>`__

A Python implementation of the Polylith tool:
`python-polylith <https://github.com/DavidVujic/python-polylith>`__


Our Community
-------------

.. raw:: html

    <blockquote class="badgr-badge" style="font-family: Helvetica, Roboto, &quot;Segoe UI&quot;, Calibri, sans-serif;"><a href="https://api.badgr.io/public/assertions/bhQ1jKReQj27qAt-jqqoPQ?identity__email=brad%40runestone.academy"><img width="120px" height="120px" src="https://media.badgr.com/uploads/badges/assertion-bhQ1jKReQj27qAt-jqqoPQ.png"></a><p class="badgr-badge-name" style="hyphens: auto; overflow-wrap: break-word; word-wrap: break-word; margin: 0; font-size: 16px; font-weight: 600; font-style: normal; font-stretch: normal; line-height: 1.25; letter-spacing: normal; text-align: left; color: #05012c;">POSE Training Program - Spring 2023 Pilot</p><p class="badgr-badge-date" style="margin: 0; font-size: 12px; font-style: normal; font-stretch: normal; line-height: 1.67; letter-spacing: normal; text-align: left; color: #555555;"><strong style="font-size: 12px; font-weight: bold; font-style: normal; font-stretch: normal; line-height: 1.67; letter-spacing: normal; text-align: left; color: #000;">Awarded: </strong>May 18, 2023</p><p style="margin: 16px 0; padding: 0;"><a class="badgr-badge-verify" target="_blank" href="https://badgecheck.io?url=https%3A%2F%2Fapi.badgr.io%2Fpublic%2Fassertions%2FbhQ1jKReQj27qAt-jqqoPQ%3Fidentity__email%3Dbrad%2540runestone.academy&amp;identity__email=brad%40runestone.academy" style="box-sizing: content-box; display: flex; align-items: center; justify-content: center; margin: 0; font-size:14px; font-weight: bold; width: 48px; height: 16px; border-radius: 4px; border: solid 1px black; text-decoration: none; padding: 6px 16px; margin: 16px 0; color: black;">VERIFY</a></p><script async="async" src="https://badgr.com/assets/widgets.bundle.js"></script></blockquote>
    
