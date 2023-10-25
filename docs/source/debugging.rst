When Things are not Working - Debugging Tips
=============================================

.. _debugging:

The Runestone Server is a complex system, but it runs in production and serves millions of requests every day.  But, there are plenty of things that can go wrong, especially when you are first starting out.  This section will cover some common problems that you might run into and suggest some ways to figure out how to get past that problem.  First a couple of general notes and then I'll try to address some frequently asked questions.

The rs repository is under continuous development so make sure that you keep it up to date by doing `git pull` frequently.  Like any system developed by humans sometimes bugs do creep into the main branch but we do our best to make sure that whatever gets pushed to main will start up and run.  If it doesn't those issues are normally fixed and corrected quickly, so it pays to keep current.

Make sure that you are running the **rs** virtual environment.  Normally your shell will show you your current virtual environment by decorating the command prompt.  Also, make sure that you keep your virtual environment up to date.  If the pyproject.toml file changes or the poetry.lock file changes then you should update your virtual environment by running `poetry install --with=dev` from the root folder of the **rs** repository.

Make sure that you run `./build.py` or `./build.py --all` command from the root folder, and pay attention to the status messages both for building the Wheels and for building the services.  If a service fails to build you should look at the log in the project folder for that service.

Many problems can be traced back to bad or missing environment variables.  Make sure to review that section and check your `.env` file for errors or typos.

Use ``docker compose ps`` to check the status of the running services.

You are trying to run the ``runestone build`` command but it fails with a stack trace, or you get command not found, or...   If you get a "command not found" error the most likely cause of that is that you have not activated the virtual environment.  Make sure that you have activated the **rs** virtual environment with the command ``poetry shell``  when you are in the ``/path/to/rs`` folder.

If you get an error when you are running runestone the first thing to do is to make sure you are running the version of the command you think you are running.  Run the command ``which runestone``, it should tell show you something like ``/path/to/rs/.venv/bin/runestone``  If the error indicates that a package or module is missing, make sure you update the virtual environment as described above.

The server does not start up.  When I run ``docker compose up`` I see messages like ``COPY ./dist/rsmanage-2.0.0-py3-none-any.whl ...``  This indicates that the build did not complete.  `COPY` is a command that runs as part of building a docker image.  ``docker compose up`` will try to build an image if one does not exist.  In this case you should go back to running the ``./build.py`` script again, and checking the logs of whatever service failed to build.

Docker builds can fail for many reasons unrelated to runestone.  Docker uses a lot of disk space, and occassionally a build will fail because docker has used up all the space it is allocated.  It pays to run the command ``docker system prune`` once a week or so to clear out docker's cache and clean up outdated images.

If you see a message containing the words ``failed to solve`` this means that docker could not resolve some dependencies.  This is mostly likely because some image upstream from runestone has changed.  In most cases just re-running the build will result in success as it can take a bit of time for the dependencies to propagate to all of the servers that support docker builds.

When I run ``docker compose up -d`` and then try to access a page, I get a ``502 Gateway error`` in my browser.  This indicates that there is a problem with one of the services.  Now is the time to use the ``docker compose logs`` command.  But it pays to be specific and target the log of the service you were trying to access.  Knowing which service you were using is as easy as looking at the URL in your browser address bar.  Most of the time the first part of the URL is the name of the service.

* ``author`` - is the author service
* ``assignment`` is the assignment server
* ``/ns`` - is the book server.  We kept the name `ns` for backward compatibility
* ``runestone`` - is the web2py server that handles the instructor interface, logging in, the peer instruction interface and the practice tool.  Each of these will migrate to new servers over time.  Again ``runestone`` was kept for backward compatibility.

Use the command ``docker compose logs --tail 100 <service>`` to look at the last 200 lines of the log for the name of the service.  If you want to actively follow the log live, you can run ``docker compose logs --tail 100 --follow <service>`` if you want to see all of the log messages for all of the servers you can omit the service name.  The logs are your friend.  They will contain error messages and lots of debugging output that you can match against the code to help you figure out what is wrong.  "Use the source luke"

I'm not getting a ``502 gateway error``, but something about a web page is not working right.

1. Check the logs, see above.
2. Check the Javascript Console / Developer tools in your browser.  If you don't know how to get to the Javascript console for your browser just google it or check your browser documentation.  Again, use the source, the messages in the javascript console will often pinpoint the location of the problem.

When I try to go to ``http://localhost`` I get a mostly blank page with a link to something like: ``192.168.65.1.2023-10-15.23-05-13.fd119be0-551e-4ad2-ad70-b010d955fc6a``  This is a sign that something in the runestone service has crashed.  If you click on it you will just get a blank page.   Check the logs as described above.  Or look for a file that has the same name as the line you see in the browser window in your ``$BOOK_PATH/tickets`` folder.  The file will contain a stack trace that will help you figure out what went wrong.  It may say that it is a binary file and ask you if you really want to view it.  You do.  Note that it may take a few minutes for the file to appear in the ``tickets`` folder as there is a process running that checks the folder inside the runestone container at ``/usr/local/lib/python3.10/site-packages/rsptx/web2py_server/applications/runestone/errors`` and copies any files it finds there to the ``$BOOK_PATH/tickets`` folder every 5 minutes.  You can change that time value by editing the ``tickets2db.py`` file.


I'm having problems installing/configuring postgresql.  There is **extensive** documentation and help available to install postgresql on almost every operating system.  I'm not going to try to duplicate any of that in this document.  A simple google search will almost certainly lead you to high quality documenation and tutorial help in setting up postgresql.

Reporting Problems
------------------

Before you come to Discord, or file an issue on Github please (re)read this section and try to solve the problem yourself.  If you are stumped then asking a question on discord is your best option.  But please follow these suggestions.

1. Be specific.  Just saying something failed is almost entirely useless. Use the logs as described above to get detailed information.
2. If you have an error message or a stack trace.  Please **copy and paste** the entire message into your post.  You can use the "picket fence markup" -- three back quotes on a line to start and then three backquotes after the message.  Please **do not** make a screen shot of a few lines from the message.  They are hard to read, and likely omit important information.
3. I repeat, use the logs to seek out specific information.
4. When describing the problem it is very important to describe exactly how you can reproduce the problem.  If you can't reproduce it then We will certainly not be able to reproduce the problem.  If we can't reproduce it then it is almost impossible for us to fix.
5. Make sure you use ``docker compose ps`` to verify that all of the services you think are running are actually running.
6. Make sure you describe your configuration when reporting a problem.  What services are you starting?  How is your database configured?  Is postgresql installed on the host, in docker? as part of the composed application?

Taking the time to carefully document how we can recreate a problem **is a valuable contribution to the project** When developers have to try to figure out how to reproduce something that is time that they could spend fixing a problem that someone else has described how to reproduce.

If you have investigated carefully and are convinced that the problem you are encountering is a bug, then please create an issue on Github.
