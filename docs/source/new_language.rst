Adding a new programming language
=====================================

One of the key capabilities of the Runestone system is being able to interactively execute and manipulate code within its textbooks. Developers may wish to add new programming languages to the system. Doing so requires making changes in a number of places. This section provides some pointers on how to make such changes.

Note that this process requires updating three different software repositories, each of which require you to set up a local development environment. These instructions try to point you in the right direction, but they are not comprehensive with regards to setting up a development environment for each project. You'll need to visit the documentation for each individual project for more information on how to do that. Likewise, you'll need to navigate some complications in testing your changes before you submit because two of these projects (PreTeXt and Runestone) each automatically install and make use components of the other project that may not have been updated it.

Here are some guidelines on how to make such changes.

Jobe
----
Jobe is the server that receives and executes programming code. It needs to be updated so that it knows how to handle instructions that it will receive to execute code in your new language.

Make updates to the Jobe repo
++++++++++++++++++++++++

The `original Jobe project  <https://github.com/trampgeek/jobe>`_ continues to be developed, but Runestone is based on a `fork of that project <https://github.com/RunestoneInteractive/jobe>`_ that was made in 2023. Updates to Jobe should be made on the Runestone fork. Therefore, make your own personal fork of the `Runestone Jobe repo <https://github.com/RunestoneInteractive/jobe>`_, and make your updates there.

The main change necessary is to create a new PHP task file. Task files exist for each of the built-in languages, and are found in the ``libraries`` directory. The simplest approach is likely to find a task file for a language that is similar to the language that you will be adding, and modify it accordingly. Jobe will automatically discover this file once you have created it; there is no need to otherwise register the new language.

The other change you should make is to the ``testsubmit.py`` file, which includes tests for all of the languages that Jobe supports. Add similar tests for your new language to those that are already there.

Test your changes to Jobe
+++++++++++++++++++++++

Once you have made your changes, you will want to locally test them. To do so, you can start Jobe in a local webserver. Runestone does this as part of its polylith architecture, but you may find it simpler to start up Jobe as a completely standalone server while you are creating and testing the above updates. You can do this via the `JobeInABox <https://github.com/trampgeek/jobeinabox>`_ project, which is a Docker container that runs Jobe within. Clone the JobeInABox repo, and then make two changes to `Dockerfile`:

* Find the line that begins with ``git clone``, and change it to pull Jobe from your forked version rather than the original.

* Add whatever content you need to install your new programming language. This is easiest if you can just add packages to the `apt-get` command, but you might have to do more.

Then follow the instructions in the JobeInABox project for starting up your local Jobe server. Specifically, issue the following commands::

    docker build . -t my/jobeinabox --build-arg TZ="America/Chicago"
    docker run -d -p 4000:80 --name jobe my/jobeinabox

That will start up your local Jobe container; once this is done, run the tests that you have written::

    docker exec -it jobe /var/www/html/jobe/testsubmit.py

Submit a pull request
+++++++++++++++++++++
If your tests pass, then submit a pull request to the `Runestone Jobe repo <https://github.com/RunestoneInteractive/jobe>`_ with your updates. Here is an `example Jobe pull request <https://github.com/RunestoneInteractive/jobe/pull/2>`_.

PreTeXt
-------
PreTeXt is the markup language used for actually writing the books. When PreTeXt outputs HTML code containing programming code for active use within Runestone, it embeds markup information within to tell the Runestone server what language is being used. You will need to update PreTeXt so that it correctly tags Runestone-viewable code for your language.

The PreTeXt team prefers that you discuss your idea with them on the development email list before you implement it and submit a pull request, so it is recommended that you do that early in the process. Make sure to first check out the `PreTeXt contributing guide <https://github.com/PreTeXtBook/pretext/blob/master/CONTRIBUTING.md>`_. 

Set up a local copy of PreTeXt source code for development
++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

Make your own personal fork of the `PreTeXt repo <https://github.com/PreTeXtBook/pretext>`_ for making your updates. Then clone it to your own computer.

In order to test your code updates, you will want to be able to run PreTeXt on your own computer. The most straightforward way to do this is to use the `PreTeXt-CLI <https://github.com/PreTeXtBook/pretext-cli?tab=readme-ov-file>`_, which is a separate project for invoking PreTeXt from the command line. Clone that repository. Follow the `instructions in the README <https://github.com/PreTeXtBook/pretext-cli?tab=readme-ov-file>`_ regarding setting up a poetry environment, and activating a shell so that you can run the ``pretext`` script. Then follow the instructions on `using the CLI when doing development on core PreTeXt <https://github.com/PreTeXtBook/pretext-cli/blob/main/docs/core_development.md>`_. 

Once you have your PreTeXt development environment working, test it before making any changes. In particular, start with the PreTeXt sample book. It's in the PreTeXt repo, in the subdirectory ``examples/sample-book``. Edit the "Runestone Testing" chapter, specifically the section titled "ActiveCode". The source for that is the file ``rune.xml``, which has a variety of examples. Find an example, and within the ``<program>`` tag, change the ``language`` property to have your new language. Of course, this won't work yet, but this will help you see what you're looking to test. Once you have made that change, build the book at the command line::

    pretext build html
    pretext view html

The second command above should open the book in a browser. Navigate to the section with the sample code you have updated. Since it is a new language, you should see no syntax highlighting. Likewise, view the source for the web page in your browser, and find the ``<code> ... </code>`` tags that surround the code you added. It should look something like this::

    <code id="..." class="language-none">
    ...
    </code>

You will be changing the code within PreTeXt so that instead of specifying ``language-none``, it specifies your language. That's how you'll know if your updates worked: look at the source code within the browser rendering the generated PreTeXt output, and see if it appropriately shows your language. You still won't see an actual code window pop up, because that requires work on the Runestone server, which you'll do as a separate task when this one is complete.


Make updates to the PreTeXt project
+++++++++++++++++++++++++++++++++++


Here is `an example pull request <https://github.com/PreTeXtBook/pretext/pull/2719>`_ that was used to add Kotlin capability to PreTeXt. Look through each of the commits, see what changes were made, and make similar updates for the language that you're adding. Here are some particular details:

* When updating the file ``pretext-common.xsl``, look at `this example <https://github.com/PreTeXtBook/pretext/pull/2719/commits/6eb5973953275fc60ea57b15f7366ff3da666b27>`_. Note that you're providing a language for use not only with PreTeXt, but with the LaTeX ``listings`` package, and for the Prism syntax highlighter. Look at each of those projects and verify if they support the language that you're adding. If they don't, you may want to leave a string empty, or alternatively, choose another language that's close enough.

* You'll need to make updates to the PreTeXt documentation, as well as to the PreTeXt sample book. Both of those are shown in the example pull request linked above.

* Not all of the PreTeXt files that mention programming languages need to be updated. The pull request linked above has a brief discussion about this, and some more details are in `these details on the PreTeXt schema <https://github.com/PreTeXtBook/pretext/blob/master/schema/README.md>`_. Specifically, you'll need to change the file ``publication-schema.xml``, but you don't need to change ``publication-schema.rnc``, ``publication-schema.rng``, or ``publication-schema.xsd`` files, as they are typically generated by the PreTeXt developers when they merge in your code.


Verify that the updates worked, and submit them
+++++++++++++++++++++++++++++++++++++++++++++++

Repeat the steps above where you build your book with PreTeXt at the command line, render it in your browser, and view the source. Verify that the property in the ``<code>`` tags actually shows your language as ``language-xxxxx`` (where ``xxxxx`` is your language) , instead of ``language-none``. If you enabled syntax highlighting via the Prism project in ``pretext-common.xsl``, you should see your code correctly highlighted when you view it in a browser.

If these updates are working, submit your pull request to the PreTeXt project.


Runestone
---------
``rs`` is the main Runestone monorepo. It contains a lot of things in it, but the relevant aspect here is the web server that renders your book and executes live code.

Setup
+++++

Follow the instructions in the `Runestone Developer Documentation <https://docs.runestone.academy/en/latest/>`_ for setting up a local development server. This is important so that you can test your changes before submitting a pull request.

Once you have the server installed, start up a shell within the ``rs`` repo, and verify that the version of PreTeXt that is installed is one that has incorporated the changes you made above. If it is still running an old version of PreTeXt, the instructions below won't work. You may need to look at the PreTeXt release timing.

Follow these instructions for `developing Javascript for Runestone components <https://docs.runestone.academy/en/latest/javascript_feature.html>`_. This will get you a cloned copy of the repo to work on, and also enable setting up your PreTeXt book with static assets.



Make updates to the ``rs`` repo
+++++++++++++++++++++++++++++++++++

Here is `an example pull request <https://github.com/RunestoneInteractive/rs/pull/1074>`_ that was used to add Kotlin capability to Runestone. Look through each of the commits, and see what changes were made, and make similar updates for the language that you're adding. Here are some particular details:

* This is where you will finally store the script modifications for installing your language. It's the same code that you added to JobeInABox, when you were testing the Jobe updates. Those will land in ``projects/jobe/Dockerfile``.

* When updating ``bases/rsptx/interactives/runestone/activecode/js/activecode.js``, you will need to add a MIME type for the language that you are adding (to enable CodeMirror correctly). Look at the `CodeMirror documentation <https://codemirror.net/5/mode/index.html>`_ to look up your language. At the bottom of each language page, it also lists what MIME types are supported.

Verify that the updates worked, and submit them
+++++++++++++++++++++++++++++++++++++++++++++++

Rebuild your PreTeXt sample book with your language functionality, and then follow the instructions for copying in static assets as described in `developing Javascript for Runestone components <https://docs.runestone.academy/en/latest/javascript_feature.html>`_. If your updates all worked, you should see live coding capability for your language appear in the browser when viewing your book.

If successful, submit a pull request to the ``rs`` repo.