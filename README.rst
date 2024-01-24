Welcome
=======

`Runestone Academy <https://landing.runestone.academy>`_ is an open-source project and *our mission is to equip the nation's STEM teachers with open-source content, tools and strategies they need to create engaging, accessible, and effective learning experiences for their students.* You might do this through our website, https://runestone.academy or by running your own server.  Or you may be an author or budding author that has a great idea for a book. Or you may be a technology coordinator that wants to run a private server.  Or you may be a researcher at a large university that is looking for a platform to test your ideas.  We are here for you.  This repository is the home of the Runestone Academy software.  We would welcome your help.  And we are happy to help you get started.

If you want to use the Runestone Academy servers to run a class using an existing book or if you want to author a book, you likely do not need to run your own copy of Runestone:

* I want to run a class based on an existing book - `Instructor guide <https://guide.runestone.academy>`_
* I want to author a book. This is now done using PreTeXt. PreTeXt is an authoring language that is designed to produce books that can be served on Runestone. `PreTeXt Author Guide <https://pretextbook.org/doc/guide/html/guide-toc.html>`_
* I want to customize a book for my class - `Customizing a Textbook <https://runestone-monorepo.readthedocs.io/en/latest/custom_book.html>`_

If you want to do development on Runestone, or run your own server, you will need to set up your own copy of the Runestone software:

* I want to contribute to the Runestone Academy software - Finish reading this page, then move on to the `Contributing Guide <https://runestone-monorepo.readthedocs.io/en/latest/contributing.html>`_
* Running a server for my own class? - coming soon
* Running a server for my school or larger group? - coming soon


Runestone MonoRepo
==================

This repository collects together the various repositories related to
the Runestone Academy software. The idea of combining several
repositories into a single structure was motivated and inspired by the
Python polylith tools and projects.

As Runestone grew over the years we accreted loads of new
functionality without ever stopping to reconsider an architecture that
would support easier implementation of new features while providing
stability for fundamental parts of the project that need to scale.
(Docker was not invented at the time Runestone development started!)





This repository uses a `polylith structure <https://polylith.gitbook.io/polylith/introduction/polylith-in-a-nutshell>`__ in order to allow the several
projects under the Runestone umbrella to share code, provide common ways
of accomplishing similar tasks, and hopefully make it easier for a
newcomer to contribute to the project.  If you don't know what a polylith is don't let that deter you.  It is just a fancy way of saying that we have a bunch of projects that share a lot of code.


Finally, in 2023 we decided to move to a mono repo. The goal of this
re-working of the Runestone code was to provide a very docker-friendly set
of servers and services using a `polylith software architecture <https://polylith.gitbook.io/polylith/introduction/polylith-in-a-nutshell>`_. The
following diagram shows what we are aiming at.

.. image:: https://runestone-monorepo.readthedocs.io/en/latest/_static/RunestoneArch.svg
   :alt: Runestone Architecture
   :align: center


Each of the servers in the diagram above has or will become a project in this
repo. Each individual server is described by a docker file and can be run either
as a docker container or on a physical server set up for the purpose. A collection of
docker compose profiles are used to control which servers are started for which purposes.

* ``basic`` - this will start up the default servers plus a database server in the composed app.
* ``dev`` - this will start up the default servers plus development nginx server in the composed app.
*  ``production`` - this will start up the default servers plus the ``pgbouncer`` server in the composed app.
*  ``author`` - this will start up the default servers plus the ``author`` server in the composed app.


Docs
----

See `Our Read the Docs page <https://runestone-monorepo.readthedocs.io/en/latest/index.html>`_ for more complete documentation. After reading the whole page, please continue to the `Contributing Guide <https://runestone-monorepo.readthedocs.io/en/latest/contributing.html>`_.


Development Roadmap
---------------------

`Runestone Roadmap <https://github.com/orgs/RunestoneInteractive/projects/6/views/1>`_

Contributing
------------

There is so much to do on this project, and we are happy to accept contributions.  Please see the `Contributing Guide <https://runestone-monorepo.readthedocs.io/en/latest/contributing.html>`_ for more information.  We are especially interested in contributions that help us to improve the documentation, and the test coverage of the code.

If you want to know where we are going, and what things are in active development or in need of immediate help please take a look at our projects page on github: `Runestone Projects <https://github.com/orgs/RunestoneInteractive/projects>`_

Longer term development goals are described in the `Runestone Roadmap <https://github.com/orgs/RunestoneInteractive/projects/6/views/1>`_.

Note that the move to a mono repo means that the history of the individual repositories was lost.  I am sorry for this, but I think the benefits of a mono repo will be worth it.  The original repositories are still available, but they are no longer being actively developed. If you need to point to your contributions to Runestone, please use the old repos as a reference.


Our Community
-------------

The Runestone community has been actively developing and supporting this project since 2011.

Join us on Discord

The new book authoring language is PreTeXt.  We have a very active community of PreTeXt authors and developers.  If you are interested in contributing to the PreTeXt project, please visit the `PreTeXt project page <https://pretextbook.org>`_.

.. raw:: html

    <blockquote class="badgr-badge" style="font-family: Helvetica, Roboto, &quot;Segoe UI&quot;, Calibri, sans-serif;"><a href="https://api.badgr.io/public/assertions/bhQ1jKReQj27qAt-jqqoPQ?identity__email=brad%40runestone.academy"><img width="120px" height="120px" src="https://media.badgr.com/uploads/badges/assertion-bhQ1jKReQj27qAt-jqqoPQ.png"></a><p class="badgr-badge-name" style="hyphens: auto; overflow-wrap: break-word; word-wrap: break-word; margin: 0; font-size: 16px; font-weight: 600; font-style: normal; font-stretch: normal; line-height: 1.25; letter-spacing: normal; text-align: left; color: #05012c;">POSE Training Program - Spring 2023 Pilot</p><p class="badgr-badge-date" style="margin: 0; font-size: 12px; font-style: normal; font-stretch: normal; line-height: 1.67; letter-spacing: normal; text-align: left; color: #555555;"><strong style="font-size: 12px; font-weight: bold; font-style: normal; font-stretch: normal; line-height: 1.67; letter-spacing: normal; text-align: left; color: #000;">Awarded: </strong>May 18, 2023</p><p style="margin: 16px 0; padding: 0;"><a class="badgr-badge-verify" target="_blank" href="https://badgecheck.io?url=https%3A%2F%2Fapi.badgr.io%2Fpublic%2Fassertions%2FbhQ1jKReQj27qAt-jqqoPQ%3Fidentity__email%3Dbrad%2540runestone.academy&amp;identity__email=brad%40runestone.academy" style="box-sizing: content-box; display: flex; align-items: center; justify-content: center; margin: 0; font-size:14px; font-weight: bold; width: 48px; height: 16px; border-radius: 4px; border: solid 1px black; text-decoration: none; padding: 6px 16px; margin: 16px 0; color: black;">VERIFY</a></p><script async="async" src="https://badgr.com/assets/widgets.bundle.js"></script></blockquote>

