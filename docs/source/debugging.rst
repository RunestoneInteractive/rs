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

Interactive Testing with ipython
--------------------------------

Using ``ipython`` it is easy to test a lot of the functionality of the runestone server.  You can start an ipython shell by running ``poetry run ipython`` from the root of the rs repository.  You can then import the runestone modules and test them interactively.  For example:  

.. code-block:: python

    from rsptx.db.crud import fetch_course
    from rich import print

    c = await fetch_course('overview')
    print(c)

    courses(
        id=13,
        course_name='overview',
        term_start_date=datetime.date(2000, 1, 1),
        base_course='overview',
        python3=True,
        login_required=False,
        allow_pairs=False,
        student_price=None,
        downloads_enabled=False,
        courselevel='',
        institution='',
        new_server=True,
        is_supporter=None
    )
    
If you set up ipython to use autoreload you can make changes and try the code again without having to restart the ipython shell.  To do this you can create a file in ``~/.ipython/profile_default/ipython_config.py`` with the following contents:

.. code-block:: python

    c.InteractiveShellApp.extensions = ['autoreload']
    c.InteractiveShellApp.exec_lines = ['%autoreload 2']
    import IPython

    ipython = IPython.get_ipython()
    if ipython is not None:
        ipython_version = IPython.__version__
        major_version = int(ipython_version.split('.')[0])
        minor_version = int(ipython_version.split('.')[1])

        if major_version < 8 or (major_version == 8 and minor_version < 1):
            ipython.magic("load_ext autoreload")
            ipython.magic("autoreload 2")
        else:
            ipython.run_line_magic(magic_name="load_ext", line="autoreload")
            ipython.run_line_magic(magic_name="autoreload", line="2")

        print("Autoreload enabled.")
    else:
        print("Autoreload not enabled.")


You can also use the ``pdb`` debugger to step through code.  You can start the debugger by adding the following line to your code:

.. code-block:: python

    import pdb; pdb.set_trace()

When you run the code it will stop at that line and you can use the following commands to step through the code:
* ``n`` - step to the next line
* ``c`` - continue to the next breakpoint
* ``q`` - quit the debugger
* ``l`` - list the code around the current line
* ``p <variable>`` - print the value of a variable
* ``h`` - get help on the debugger commands

Most all of the functions under components can be tested this way!  

Check the values in the database
--------------------------------

You can use the pgcli tool to interactively query the database.  You can start pgcli with the command ``rsmanage db`` or ``dockcer compose run rsmanage rsmanage db`` You can then use SQL commands to query the database.  For example:

.. code-block:: sql

    select * from useinfo limit 10 order by id desc

This will return something like:

.. code-block:: sql

    +------------+----------------------------+----------------------+-------------+------------------------------------------>
    | id         | timestamp                  | sid                  | event       | act                                      >
    |------------+----------------------------+----------------------+-------------+------------------------------------------>
    | 1002480995 | 2024-07-09 19:16:46.426241 | uras_xxxxxxxx        | page        | view                                     >
    | 1002480994 | 2024-07-09 19:16:46.200012 | pexxxxxxxxxx@sou.edu | mChoice     | answer:1:correct                         >
    | 1002480993 | 2024-07-09 19:16:45.729995 | Anonymous            | page        | view                                     >
    | 1002480992 | 2024-07-09 19:16:45.569879 | laxxxxxx             | parsonsMove | move|13_0-7_0-9_0|0_1_0-2_0-3_0-4_5_0-6_0>
    | 1002480991 | 2024-07-09 19:16:45.081719 | Anonymous            | page        | view                                     >
    | 1002480990 | 2024-07-09 19:16:44.098338 | laxxxxxx             | parsonsMove | move|13_0-7_0-9_0|0_1_0-2_0-3_0-6_0-8_0-1>
    | 1002480989 | 2024-07-09 19:16:43.092947 | Anonymous            | page        | view                                     >
    | 1002480988 | 2024-07-09 19:16:42.327945 | pexxxxxxxxxx@sou.edu | mChoice     | answer:4:no                              >
    | 1002480987 | 2024-07-09 19:16:41.92033  | laxxxxxx             | parsonsMove | move|13_0-7_0-9_0|12_0-0_1_0-2_0-3_0-6_0->
    | 1002480986 | 2024-07-09 19:16:40.544834 | Anonymous            | page        | view                                     >
    +------------+----------------------------+----------------------+-------------+------------------------------------------>
    SELECT 10

This will show you the last 10 rows in the useinfo table.  You can use any SQL command that you like to query the database.  If you are not familiar with SQL there are many tutorials available on the web.  You don't need to be an expert to learn enough sql to see what is going on in the database.

To give you a quick guided tour of the database I'll just mention some tables.  the definitions for these tables are in the ``db/models.py`` file.

* ``useinfo`` - this table records every event that happens in the system.  It is used to track student progress and to generate reports.
* ``user_courses`` - this table records which courses a student is enrolled in.
* ``mchoice_answers`` - this table records the answers to multiple choice questions.
* ``fitb_answers`` - this table records the answers to fill in the blank questions.
* ``xxx_answers`` - there are many other tables that record answers to various types of questions.
* ``auth_user`` - this table records the users that are allowed to log in to the system.
* ``auth_group`` - this table records the groups that users can belong to. for example instructor, editor, author.
* ``auth_membership`` - this table records the membership of users in groups.
* ``course_instructor`` - this table records the instructors for each course.
* ``courses`` - this table records the courses that are available in the system.  It is used to generate the course selection page.
* ``user_courses`` - this table records the courses that each user is enrolled in.
* ``assignments`` - this table records the assignments that are available in the system.  
* ``questions`` - this table records the questions that are available in the system. 
* ``assignments_questions`` - this table records the relationship between assignments and questions.
* ``question_grades`` - this table records the grades that students have received on questions.
* ``grades`` - this table records the grades that students have received on assignments.

Using the Javascript Console
----------------------------

Since much of Runestone is written in Javascript you need to learn how to use the Javascript console effectively.  Although most everyone knows how to open it by using the F12 key, or right clicking on a page and selecting "Inspect". Some browsers have other shortcuts that you can google.  There are several very useful tabs.

* **Console** - This is where you can type Javascript commands and see the output.  You can also see error messages here.
* **Network** - This tab shows you all of the network requests that are made by the page.  You can see the request and response headers, and the response body.  This is very useful for debugging AJAX requests.  If you click on a request you can see the headers and the response body.  You can also see the cookies that are sent with the request.
* **Sources** - This tab shows you all of the Javascript files that are loaded by the page.  You can set breakpoints in the code, and step through the code.  You can also see the values of variables at any point in the code.  This is very useful for debugging Javascript code.
* **Application** - This tab shows you the cookies that are set by the page.  You can see the values of the cookies, and you can delete them.  This is useful for debugging problems with cookies.
* **Elements** - This tab shows you the HTML of the page.  You can see the structure of the page, and you can edit the HTML.  This is useful for debugging problems with the layout of the page or with CSS.


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
